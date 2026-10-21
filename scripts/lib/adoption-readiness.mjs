import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { loadArtifactGraphConfig, loadProjectArtifactProfiles } from './artifact-graph-runtime.mjs';
import { buildCheckerOutput, loadProfile } from './workflow-profile.mjs';

const PROJECT_SHAPES = ['cli-library', 'web', 'desktop', 'skill-plugin'];
const ADOPTION_STAGES = ['initial', 'legacy-backfill', 'daily-iteration'];
const APPLICABILITY = Object.freeze({
  common_minimum: 'common_minimum',
  project_standard: 'project_standard',
  lifecycle: 'lifecycle',
  conditional: 'conditional',
  project_extra: 'project_extra',
});

const TEMPLATE_PATHS = {
  requirement: 'templates/core/requirement-entry.starter.md',
  spec: 'templates/core/spec-entry.starter.md',
  feature: 'templates/core/feature/starter.md',
  scenario: 'templates/core/scenario/starter.md',
  decision: 'templates/core/decision/starter.md',
  design: 'templates/core/design/starter.md',
  test: 'templates/core/test/starter.md',
  e2e_test: 'templates/core/e2e_test/starter.md',
  cli_contract: 'templates/extended/contracts/cli_contract/starter.md',
  ui_contract: 'templates/extended/contracts/ui_contract/starter.md',
  api_contract: 'templates/extended/contracts/api_contract/starter.md',
  ipc_contract: 'templates/extended/contracts/ipc_contract/starter.md',
  agent_skill: 'templates/extended/agent/agent_skill/starter.md',
  hook_policy: 'templates/extended/agent/hook_policy/starter.md',
  prompt_packet: 'templates/extended/agent/prompt_packet/starter.md',
  data_contract: 'templates/extended/contracts/data_contract/starter.md',
  release_policy: 'templates/extended/governance/release_policy/starter.md',
  domain_model: 'templates/extended/domain/domain_model/starter.md',
};

function unique(values) {
  return [...new Set(values)];
}

function flowMappingKeys(text) {
  const keys = [];
  let depth = 0;
  let index = 0;
  let quote = null;
  let collect = false;
  let token = '';
  let expectKey = false;
  while (index < text.length) {
    const char = text[index];
    if (quote) {
      if (char === '\\' && quote === '"') {
        if (collect) token += text[index + 1] ?? '';
        index += 2;
        continue;
      }
      if (char === quote) {
        quote = null;
        index += 1;
        continue;
      }
      if (collect) token += char;
      index += 1;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      if (depth === 1 && expectKey) {
        collect = true;
        expectKey = false;
        token = '';
      }
      index += 1;
      continue;
    }
    if (char === '{' || char === '[') {
      depth += 1;
      if (char === '{' && depth === 1) expectKey = true;
      index += 1;
      continue;
    }
    if (char === '}' || char === ']') {
      depth -= 1;
      collect = false;
      token = '';
      if (depth === 0) break;
      index += 1;
      continue;
    }
    if (depth === 1 && expectKey) {
      if (char === ' ' || char === '\t' || char === '\n' || char === '\r' || char === ',') {
        index += 1;
        continue;
      }
      if (/[A-Za-z]/u.test(char)) {
        collect = true;
        expectKey = false;
        token = char;
        index += 1;
        continue;
      }
    }
    if (collect) {
      if (/[A-Za-z0-9_-]/u.test(char)) {
        token += char;
        index += 1;
        continue;
      }
      if (char === ' ' || char === '\t') {
        index += 1;
        continue;
      }
      if (char === ':') {
        if (/^[A-Za-z][A-Za-z0-9_-]*$/u.test(token)) keys.push(token);
        collect = false;
        token = '';
        index += 1;
        continue;
      }
      collect = false;
      token = '';
    }
    if (char === ',' && depth === 1) expectKey = true;
    index += 1;
  }
  return keys;
}

function blockMappingKeys(source, typesIndex) {
  const lineStart = source.lastIndexOf('\n', typesIndex) + 1;
  const lineEnd = source.indexOf('\n', typesIndex);
  const typesLine = source.slice(lineStart, lineEnd < 0 ? source.length : lineEnd);
  const indent = (typesLine.match(/^[ \t]*/u)?.[0] ?? '').length;
  if (lineEnd < 0) return [];
  const keys = [];
  let childIndent = null;
  for (const line of source.slice(lineEnd + 1).split('\n')) {
    if (/^[ \t]*#/u.test(line) || /^[ \t]*$/u.test(line)) continue;
    const leading = line.match(/^[ \t]*/u)?.[0] ?? '';
    if (leading.includes('\t') || leading.length <= indent) break;
    childIndent ??= leading.length;
    if (leading.length !== childIndent) continue;
    const key = line.slice(leading.length).match(/^(?:([A-Za-z][A-Za-z0-9_-]*)|"([A-Za-z][A-Za-z0-9_-]*)"|'([A-Za-z][A-Za-z0-9_-]*)')[ \t]*:/u);
    if (key) keys.push(key[1] ?? key[2] ?? key[3]);
  }
  return keys;
}

function declaredConfigTypeNames(source) {
  if (typeof source !== 'string' || source.length === 0) return [];
  const match = /(?:^|\n)types:[ \t]*/u.exec(source);
  if (!match) return [];
  const typesIndex = match.index + match[0].indexOf('types:');
  const rest = source.slice(typesIndex + 'types:'.length).replace(/^[ \t]+/u, '');
  if (rest.startsWith('{')) return flowMappingKeys(rest);
  return blockMappingKeys(source, typesIndex);
}

function addCandidate(map, type, applicability, condition = null) {
  const current = map.get(type) ?? { type, applicability: [], condition: null };
  if (!current.applicability.includes(applicability)) current.applicability.push(applicability);
  if (condition && !current.condition) current.condition = condition;
  map.set(type, current);
}

function candidatesFromProfiles(profiles, projectShape, adoptionStage) {
  const map = new Map();
  for (const type of profiles.common_minimum ?? []) {
    addCandidate(map, type, APPLICABILITY.common_minimum);
  }
  const standard = profiles.project_standards?.[projectShape];
  for (const type of standard?.additional_types ?? []) {
    addCandidate(map, type, APPLICABILITY.project_standard);
  }
  for (const entry of profiles.lifecycle ?? []) {
    if (entry.adoption_stages?.includes(adoptionStage)) {
      addCandidate(map, entry.type, APPLICABILITY.lifecycle, entry.condition ?? null);
    }
  }
  for (const entry of profiles.conditional ?? []) {
    if (entry.project_shapes?.includes(projectShape)) {
      addCandidate(map, entry.type, APPLICABILITY.conditional, entry.condition ?? null);
    }
  }
  return map;
}

function isStandardApplicability(applicability) {
  return applicability.includes(APPLICABILITY.common_minimum) || applicability.includes(APPLICABILITY.project_standard);
}

function contained(root, target) {
  const rel = relative(root, target);
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
}

function pathDirectory(projectRoot, pattern) {
  const wildcard = pattern.search(/[*?[{]/u);
  const prefix = wildcard >= 0 ? pattern.slice(0, wildcard) : pattern;
  const relativeDirectory = wildcard >= 0 ? prefix.replace(/[\\/]$/u, '') : dirname(prefix);
  return resolve(projectRoot, relativeDirectory || '.');
}

function directoryExists(projectRoot, patterns) {
  return patterns.some(pattern => {
    const directory = pathDirectory(projectRoot, pattern);
    if (!contained(projectRoot, directory)) return false;
    try {
      return statSync(directory).isDirectory();
    } catch {
      return false;
    }
  });
}

function profileDomain(type) {
  if (type === 'feature') return 'prd-feature';
  if (type === 'scenario') return 'scenario-script';
  return type.replaceAll('_', '-');
}

function artifactType(domain) {
  if (domain === 'prd-feature') return 'feature';
  if (domain === 'scenario-script') return 'scenario';
  if (domain === 'design-spec') return 'design';
  return domain.replaceAll('-', '_');
}

function profileTypes(profile) {
  return unique(Object.values(profile?.workflows ?? {}).flatMap(domains => Object.keys(domains ?? {}).map(artifactType)));
}

function profileMethodDomain(profile, type, action) {
  const domain = profileDomain(type);
  if (profile?.workflows?.[action]?.[domain]) return domain;
  if (type === 'design' && profile?.workflows?.[action]?.['design-spec']) return 'design-spec';
  return null;
}

function publicMethod(method) {
  const visible = { ...method };
  delete visible.template_paths;
  return visible;
}

function bundledTemplate(type, pluginRoot) {
  const templateRelativePath = TEMPLATE_PATHS[type] ?? null;
  const templatePath = templateRelativePath ? join(pluginRoot, templateRelativePath) : null;
  const ready = Boolean(templatePath && existsSync(templatePath));
  return {
    ready,
    path: templatePath,
    gap: ready ? null : 'starter template is missing',
  };
}

function blockedProfileTemplate(error) {
  return {
    ready: false,
    path: null,
    gap: error,
  };
}

function selectedTemplate(declared, verified) {
  const declaredPaths = Array.isArray(declared) ? declared : [];
  const verifiedPaths = Array.isArray(verified) ? verified.filter(item => typeof item === 'string' && item.length > 0) : [];
  const ready = declaredPaths.length > 0 && verifiedPaths.length === declaredPaths.length;
  const detail = declaredPaths.length === 0 ? 'empty mapping' : declaredPaths.map(item => String(item)).join(', ');
  return {
    ready,
    path: ready ? verifiedPaths[0] : null,
    gap: ready ? null : `selected generate templates are not all available: ${detail}`,
  };
}

async function methodReadiness({ projectRoot, profilePath, profile, type, action, templateAvailable, pluginRoot }) {
  const domain = profileMethodDomain(profile, type, action);
  if (domain) {
    const checked = await buildCheckerOutput({
      root: projectRoot,
      profilePath,
      intent: action,
      domain,
      runValidatorCommands: false,
    });
    return {
      status: checked.status,
      execution_mode: checked.execution_mode,
      worker_path: checked.worker_path,
      project_specific_method_ready: checked.status === 'OK' && checked.execution_mode === 'project-worker',
      diagnostics: checked.diagnostics,
      template_paths: checked.template_paths ?? [],
    };
  }

  if (['requirement', 'spec'].includes(type) && action === 'generate') {
    const skillPath = join(pluginRoot, 'skills', 'artifact-chain-requirements', 'SKILL.md');
    const ready = templateAvailable && existsSync(skillPath);
    return {
      status: ready ? 'OK' : 'NEEDS_INPUT',
      execution_mode: ready ? 'bundled-skill' : null,
      worker_path: ready ? skillPath : null,
      project_specific_method_ready: false,
      diagnostics: ready ? [] : ['bundled requirement/SPEC skill or starter template is missing'],
    };
  }

  return {
    status: 'NEEDS_INPUT',
    execution_mode: null,
    worker_path: null,
    project_specific_method_ready: false,
    diagnostics: [`No ${action} workflow method is configured for ${type}`],
  };
}

export async function checkAdoptionReadiness({
  root = process.cwd(),
  projectShape,
  adoptionStage,
  profilePath,
  selectedTypes = [],
  env,
} = {}) {
  if (!PROJECT_SHAPES.includes(projectShape)) {
    throw new Error(`project shape must be one of: ${PROJECT_SHAPES.join(', ')}`);
  }
  if (!ADOPTION_STAGES.includes(adoptionStage)) {
    throw new Error(`adoption stage must be one of: ${ADOPTION_STAGES.join(', ')}`);
  }
  if (!Array.isArray(selectedTypes) || selectedTypes.some(type => typeof type !== 'string' || !/^[a-z][a-z0-9_-]*$/u.test(type))) {
    throw new Error('selected types must be an array of artifact type names');
  }

  const projectRoot = resolve(root);
  const pluginRoot = resolve(import.meta.dirname, '..', '..');
  const hasConfig = existsSync(join(projectRoot, 'artifact-graph.config.yaml'));
  const [configResult, loadedProfile, profilesResult] = await Promise.all([
    loadArtifactGraphConfig({ projectRoot, env }),
    loadProfile({ root: projectRoot, profilePath }),
    loadProjectArtifactProfiles({ projectRoot, env }),
  ]);
  const schema = configResult.ok && hasConfig ? configResult.schema : null;
  const configRaw = hasConfig ? readFileSync(join(projectRoot, 'artifact-graph.config.yaml'), 'utf8') : '';
  const declaredTypes = hasConfig ? declaredConfigTypeNames(configRaw) : [];
  const profiledTypes = loadedProfile.data ? profileTypes(loadedProfile.data) : [];
  const evidenceTypes = unique([...declaredTypes, ...profiledTypes, ...selectedTypes]);
  const candidateMap = profilesResult.ok
    ? candidatesFromProfiles(profilesResult.profiles, projectShape, adoptionStage)
    : new Map();
  for (const type of evidenceTypes) {
    if (!candidateMap.has(type)) addCandidate(candidateMap, type, APPLICABILITY.project_extra);
  }
  const candidates = [...candidateMap.values()];
  const enabledTypes = candidates.filter(item => evidenceTypes.includes(item.type)).map(item => item.type);
  const candidateTypes = candidates.map(item => ({
    type: item.type,
    enabled: enabledTypes.includes(item.type),
    applicability: item.applicability,
    condition: item.condition,
    sources: [
      ...(declaredTypes.includes(item.type) ? ['effective-config'] : []),
      ...(profiledTypes.includes(item.type) ? ['workflow-profile'] : []),
      ...(selectedTypes.includes(item.type) ? ['explicit-selection'] : []),
    ],
    template_available: Boolean(TEMPLATE_PATHS[item.type] && existsSync(join(pluginRoot, TEMPLATE_PATHS[item.type]))),
  }));
  const missingStandardTypes = candidateTypes
    .filter(item => isStandardApplicability(item.applicability) && !item.enabled)
    .map(item => item.type);
  const artifacts = [];

  for (const type of enabledTypes) {
    const typeDefinition = schema?.types?.[type];
    const paths = Array.isArray(typeDefinition?.paths) ? typeDefinition.paths : [];
    const idPattern = typeof schema?.idPatterns?.[type] === 'string' ? schema.idPatterns[type] : null;
    const typeDeclared = Boolean(typeDefinition);
    const pathDirectoryPresent = directoryExists(projectRoot, paths);
    const typeRegistered = typeDeclared && Boolean(idPattern) && paths.length > 0 && pathDirectoryPresent;
    const templateAvailable = Boolean(TEMPLATE_PATHS[type] && existsSync(join(pluginRoot, TEMPLATE_PATHS[type])));
    const generateRaw = await methodReadiness({ projectRoot, profilePath, profile: loadedProfile.data, type, action: 'generate', templateAvailable, pluginRoot });
    const reviewRaw = await methodReadiness({ projectRoot, profilePath, profile: loadedProfile.data, type, action: 'review', templateAvailable, pluginRoot });
    const generateDomain = profileMethodDomain(loadedProfile.data, type, 'generate');
    const profileLoadFailed = Boolean(loadedProfile.error) && loadedProfile.data == null;
    const template = profileLoadFailed
      ? blockedProfileTemplate(loadedProfile.error)
      : generateDomain
        ? selectedTemplate(loadedProfile.data?.workflows?.generate?.[generateDomain]?.templates, generateRaw.template_paths)
        : bundledTemplate(type, pluginRoot);
    const generate = publicMethod(generateRaw);
    const review = publicMethod(reviewRaw);
    const gaps = [];
    if (!configResult.ok) gaps.push(`effective config is unavailable: ${configResult.reason}`);
    if (!typeDeclared) gaps.push('type is not declared in the effective config');
    if (!idPattern) gaps.push('id pattern is not declared in the effective config');
    if (paths.length === 0) gaps.push('artifact paths are not declared in the effective config');
    else if (!pathDirectoryPresent) gaps.push('artifact path directory does not exist');
    if (template.gap) gaps.push(template.gap);
    if (generate.status !== 'OK') gaps.push('generation method is not executable');
    if (review.status !== 'OK') gaps.push('review method is not executable');
    artifacts.push({
      type,
      enabled_by: candidateTypes.find(candidate => candidate.type === type).sources,
      registration: {
        ready: typeRegistered,
        paths,
        path_directory_present: pathDirectoryPresent,
        id_pattern: idPattern,
        target: typeDefinition?.target === true,
        aliases: typeDefinition?.aliases ?? [],
      },
      template: { ready: template.ready, path: template.path },
      methods: { generate, review },
      gaps,
    });
  }

  const ready = artifacts.length > 0 && artifacts.every(item => item.registration.ready && item.template.ready && item.methods.generate.status === 'OK' && item.methods.review.status === 'OK');
  const diagnostics = [];
  const profileContract = profilesResult.ok
    ? {
        status: 'OK',
        schema_version: profilesResult.profiles.schema_version,
        source: 'artifact-graph/project-artifact-profiles',
        reason: null,
      }
    : {
        status: 'UNAVAILABLE',
        schema_version: null,
        source: 'artifact-graph/project-artifact-profiles',
        reason: profilesResult.reason,
      };
  if (!profilesResult.ok) {
    diagnostics.push(`Project artifact profiles unavailable: ${profilesResult.reason}. List-dependent recommendations are paused; copied STAGE/SHAPE tables are not used.`);
  }
  if (!configResult.ok) diagnostics.push(`Effective artifact-graph config unavailable: ${configResult.reason}`);
  if (loadedProfile.error) diagnostics.push(loadedProfile.error);
  if (missingStandardTypes.length > 0) {
    diagnostics.push(`Common or skill-plugin standard types are visible and not adopted: ${missingStandardTypes.join(', ')}. Reading the list does not enable them.`);
  }
  if (enabledTypes.length === 0) diagnostics.push('No candidate artifact type is enabled by effective config, workflow profile, or explicit selection.');
  if (!ready && enabledTypes.length > 0) diagnostics.push('One or more enabled artifact types are not fully ready; inspect each item.gaps.');
  return {
    status: profilesResult.ok && ready ? 'OK' : 'NEEDS_INPUT',
    root: projectRoot,
    project_shape: projectShape,
    adoption_stage: adoptionStage,
    profile_contract: profileContract,
    candidate_types: candidateTypes,
    enabled_types: enabledTypes,
    missing_standard_types: missingStandardTypes,
    artifacts,
    diagnostics,
    next: ready
      ? 'Use the reported templates and executable methods.'
      : 'Choose only relevant candidates, then add the missing config, directory, template, or method reported for enabled types.',
    dry_run: true,
  };
}

export const adoptionReadinessOptions = Object.freeze({
  projectShapes: PROJECT_SHAPES,
  adoptionStages: ADOPTION_STAGES,
});
