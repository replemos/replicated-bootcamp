# Implementation Notes

## Next.js Version

**Next.js 16.2.2 is installed** (plan was written against Next.js 14 conventions).
Before implementing any API routes, pages, or layouts, consult local docs at:
`node_modules/next/dist/docs/`

## Prisma Version

**Prisma 7** is installed. Key differences from Prisma 5:
- `prisma init` generates `prisma.config.ts` at the root in addition to `prisma/schema.prisma`
- Default client output location may differ — verify with `npx prisma generate`
- Import from `@prisma/client` OR `../src/generated/prisma` depending on output config

## Auth

Using `next-auth@4` with credentials provider (JWT strategy). No database adapter needed.
`@auth/prisma-adapter` was NOT installed (incompatible with next-auth v4).
