// Environment for driverOnboarding.e2e.spec.ts.
//
// MUST be imported before the rest of the spec (ES imports hoist in
// declaration order, so keep this as the FIRST import) — JwtStrategy reads
// process.env.JWT_ACCESS_SECRET when the testing module instantiates it.
// The lean module never constructs PrismaClient, mail or stripe providers,
// so no other secrets are needed and none here is a real credential.
process.env.JWT_ACCESS_SECRET ??= "e2e-test-access-secret";
