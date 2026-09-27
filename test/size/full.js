import { createMira } from "@mirafive/sdk-browser"
import { pageviews } from "@mirafive/sdk-browser/pageviews"
import { identity } from "@mirafive/sdk-browser/identity"
import { autocapture } from "@mirafive/sdk-browser/autocapture"
import { siteSearch } from "@mirafive/sdk-browser/search"
import { flags } from "@mirafive/sdk-browser/flags"
import { experiments } from "@mirafive/sdk-browser/experiments"
import { astro } from "@mirafive/sdk-astro/client"

createMira({ "key":"mf_ab12cd34_0123456789abcdefghijklmnop","mode":"full", plugins: [pageviews(), identity(), autocapture(), siteSearch(), flags(), experiments(), astro()] })
