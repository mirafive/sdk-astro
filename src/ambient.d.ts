declare module "astro:env/server" {
  export const getSecret: (key: string) => string | undefined
}

declare module "*.astro" {
  const component: (props: object) => unknown
  export default component
}
