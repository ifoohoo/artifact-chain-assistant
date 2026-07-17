export function validateCatalogPackageVersion(catalog, packageJson) {
  const catalogVersion = catalog?.catalog?.version;
  const packageVersion = packageJson?.version;
  return catalogVersion === packageVersion
    ? []
    : [`catalog.version ${String(catalogVersion)} must equal package version ${String(packageVersion)}`];
}
