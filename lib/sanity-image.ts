import { createImageUrlBuilder } from "@sanity/image-url";
import { client } from "./sanity-config";

const builder = createImageUrlBuilder(client);

export function urlForImage(source: Parameters<typeof builder.image>[0]) {
    return builder.image(source);
}
