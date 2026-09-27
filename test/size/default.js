import { createMira } from "@mirafive/sdk-browser"
import { pageviews } from "@mirafive/sdk-browser/pageviews"
import { astro } from "@mirafive/sdk-astro/client"

createMira({ "key":"mf_ab12cd34_0123456789abcdefghijklmnop", plugins: [pageviews(), astro()] })
