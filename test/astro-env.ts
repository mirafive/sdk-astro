export const getSecret = (key: string): string | undefined => process.env[key]
