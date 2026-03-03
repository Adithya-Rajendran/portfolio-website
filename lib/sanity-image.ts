import { createImageUrlBuilder } from "@sanity/image-url";
import { client } from "./sanity-client";

const builder = createImageUrlBuilder(client);

export function urlForImage(source: Parameters<typeof builder.image>[0]) {
    return builder.image(source);
}
