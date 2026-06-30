export { appRouter, type AppRouter } from './root';
export { createTRPCContext, type Context, type AuthenticatedUser } from './context';
export { createCallerFactory } from './trpc';
// Exposed for non-production fault-injection tests (compensation / retry).
export { PublicationReviewService, type PublicationFault } from './services/publication';
