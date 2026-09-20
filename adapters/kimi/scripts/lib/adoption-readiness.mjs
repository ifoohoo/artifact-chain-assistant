import { existsSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { loadArtifactGraphConfig } from './artifact-graph-runtime.mjs';
import { buildCheckerOutput, loadProfile } from './workflow-profile.mjs';

const PROJECT_SHAPES = ['cli-library', 'web', 'desktop', 'skill-plugin'];
const ADOPTION_STAGES = ['initial', 'legacy-backfill', 'daily-iteration'];

const STAGE_CANDIDATES = {
  initial: ['requirement', 'feature', 'decision'],
  'legacy-backfill': ['feature', 'scenario', 'decision', 'design', 'test'],
  'daily-iteration': ['requirement', 'spec', 'feature', 'scenario', 'decision', 'design', 'test'],
};

const SHAPE_CANDIDATES = {
  'cli-library': ['cli_contract'],
  web: ['ui_contract', 'api_contract'],
  desktop: ['ui_contract', 'ipc_contract', 'e2e_test'],
  'skill-plugin': ['agent_skill', 'hook_policy', 'prompt_packet'],
};

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
};

function unique(values) {
  return [...new Set(values)];
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
  return domain.replaceAll('-', '_');
}

function profileTypes(profile) {
  return unique(Object.values(profile?.workflows ?? {}).flatMap(domains => Object.keys(domains ?? {}).map(artifactType)));
}

function hasProfileMethod(profile, type, action) {
  return Boolean(profile?.workflows?.[action]?.[profileDomain(type)]);
}

async function methodReadiness({ projectRoot, profilePath, profile, type, action, templateAvailable, pluginRoot }) {
  if (hasProfileMethod(profile, type, action)) {
    const checked = await buildCheckerOutput({
      root: projectRoot,
      profilePath,
      intent: action,
      domain: profileDomain(type),
      runValidatorCommands: false,
    });
    return {
      status: checked.status,
      execution_mode: checked.execution_mode,
      worker_path: checked.worker_path,
      project_specific_method_ready: checked.status === 'OK' && checked.execution_mode === 'project-worker',
      diagnostics: checked.diagnostics,
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
  const [configResult, loadedProfile] = await Promise.all([
    loadArtifactGraphConfig({ projectRoot, env }),
    loadProfile({ root: projectRoot, profilePath }),
  ]);
  const schema = configResult.ok && hasConfig ? configResult.schema : null;
  const configuredTypes = schema ? Object.keys(schema.types ?? {}) : [];
  const profiledTypes = loadedProfile.data ? profileTypes(loadedProfile.data) : [];
  const candidates = unique([...STAGE_CANDIDATES[adoptionStage], ...SHAPE_CANDIDATES[projectShape]]);
  const evidenceTypes = new Set([...configuredTypes, ...profiledTypes, ...selectedTypes]);
  const enabledTypes = candidates.filter(type => evidenceTypes.has(type));
  const candidateTypes = candidates.map(type => ({
    type,
    enabled: enabledTypes.includes(type),
    sources: [
      ...(configuredTypes.includes(type) ? ['effective-config'] : []),
      ...(profiledTypes.includes(type) ? ['workflow-profile'] : []),
      ...(selectedTypes.includes(type) ? ['explicit-selection'] : []),
    ],
    template_available: Boolean(TEMPLATE_PATHS[type] && existsSync(join(pluginRoot, TEMPLATE_PATHS[type]))),
  }));
  const artifacts = [];

  for (const type of enabledTypes) {
    const typeDefinition = schema?.types?.[type];
    const paths = Array.isArray(typeDefinition?.paths) ? typeDefinition.paths : [];
    const idPattern = typeof schema?.idPatterns?.[type] === 'string' ? schema.idPatterns[type] : null;
    const typeDeclared = Boolean(typeDefinition);
    const pathDirectoryPresent = directoryExists(projectRoot, paths);
    const typeRegistered = typeDeclared && Boolean(idPattern) && paths.length > 0 && pathDirectoryPresent;
    const templateRelativePath = TEMPLATE_PATHS[type] ?? null;
    const templatePath = templateRelativePath ? join(pluginRoot, templateRelativePath) : null;
    const templateAvailable = Boolean(templatePath && existsSync(templatePath));
    const generate = await methodReadiness({ projectRoot, profilePath, profile: loadedProfile.data, type, action: 'generate', templateAvailable, pluginRoot });
    const review = await methodReadiness({ projectRoot, profilePath, profile: loadedProfile.data, type, action: 'review', templateAvailable, pluginRoot });
    const gaps = [];
    if (!configResult.ok) gaps.push(`effective config is unavailable: ${configResult.reason}`);
    if (!typeDeclared) gaps.push('type is not declared in the effective config');
    if (!idPattern) gaps.push('id pattern is not declared in the effective config');
    if (paths.length === 0) gaps.push('artifact paths are not declared in the effective config');
    else if (!pathDirectoryPresent) gaps.push('artifact path directory does not exist');
    if (!templateAvailable) gaps.push('starter template is missing');
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
      template: { ready: templateAvailable, path: templatePath },
      methods: { generate, review },
      gaps,
    });
  }

  const ready = artifacts.length > 0 && artifacts.every(item => item.registration.ready && item.template.ready && item.methods.generate.status === 'OK' && item.methods.review.status === 'OK');
  const diagnostics = [];
  if (!configResult.ok) diagnostics.push(`Effective artifact-graph config unavailable: ${configResult.reason}`);
  if (loadedProfile.error) diagnostics.push(loadedProfile.error);
  if (enabledTypes.length === 0) diagnostics.push('No candidate artifact type is enabled by effective config, workflow profile, or explicit selection.');
  if (!ready && enabledTypes.length > 0) diagnostics.push('One or more enabled artifact types are not fully ready; inspect each item.gaps.');
  return {
    status: ready ? 'OK' : 'NEEDS_INPUT',
    root: projectRoot,
    project_shape: projectShape,
    adoption_stage: adoptionStage,
    candidate_types: candidateTypes,
    enabled_types: enabledTypes,
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
