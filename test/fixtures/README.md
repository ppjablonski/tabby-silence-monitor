`tabby-middleware.ts` is copied unchanged from Eugeny/tabby v1.0.238
(commit 54869e1), `tabby-terminal/src/api/middleware.ts` (MIT; see
TABBY-LICENSE). Tests execute this real pipeline with RxJS 7 and a small
SubscriptionContainer substitute. It is test-only and never bundled.

`tabby-plugins.ts` is copied unchanged from the same v1.0.238 commit,
`app/src/plugins.ts` (MIT; see TABBY-LICENSE). Discovery tests extract and execute
its actual candidate-scanning and metadata-parsing functions. They do not execute
its global require hooks. Filesystem operations use Node APIs in place of mz/fs.
