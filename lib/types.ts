import { links } from "./data";

// "Home" is not a nav link (the top intro has no anchor entry) but it is
// the scroll-spy's default active section and the context's initial value,
// so it stays in the union even though it is absent from `links`.
export type SectionName = (typeof links)[number]["name"] | "Home";
