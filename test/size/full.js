import { createMira } from "@mirafive/sdk-browser"
import { pageviews } from "@mirafive/sdk-browser/pageviews"
import { identity } from "@mirafive/sdk-browser/identity"
import { autocapture } from "@mirafive/sdk-browser/autocapture"
import { siteSearch } from "@mirafive/sdk-browser/search"
import { astro } from "@mirafive/sdk-astro/client"

createMira({ "key":"mf_ab12cd34_0123456789abcdefghijklmnop","mode":"full", plugins: [pageviews(), identity(), autocapture(), siteSearch(), astro()] })
