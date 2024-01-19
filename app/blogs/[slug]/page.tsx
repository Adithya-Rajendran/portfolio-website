import Image from "next/image";
import serverImg from "@/public/homelab.webp";

export default function BlogName() {
    return (
        <div className="px-4 py-6 md:px-6 lg:py-16 md:py-12">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <article className="prose prose-gray mx-auto dark:prose-invert lg:col-span-2 px-12">
                    <div className="space-y-2 not-prose">
                        <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl lg:leading-[3.5rem]">
                            Taxing Laughter: The Joke Tax Chronicles
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400">
                            Posted on August 24, 2023
                        </p>
                    </div>
                    <p>
                        Once upon a time, in a far-off land, there was a very
                        lazy king who spent all day lounging on his throne. One
                        day, his advisors came to him with a problem: the
                        kingdom was running out of money.
                    </p>
                    <p>
                        Jokester began sneaking into the castle in the middle of
                        the night and leaving jokes all over the place: under
                        the king's pillow, in his soup, even in the royal
                        toilet. The king was furious, but he couldn't seem to
                        stop Jokester.
                    </p>
                    <p>
                        And then, one day, the people of the kingdom discovered
                        that the jokes left by Jokester were so funny that they
                        couldn't help but laugh. And once they started laughing,
                        they couldn't stop.
                    </p>
                    <figure>
                        <Image
                            src={serverImg}
                            alt="Cover image"
                            className="aspect-video object-cover"
                            height={340}
                            width={1250}
                        />
                        <figcaption>Image caption goes here</figcaption>
                    </figure>
                    <p>
                        The king thought long and hard, and finally came up with
                        <a href="#">a brilliant plan</a>: he would tax the jokes
                        in the kingdom.
                    </p>
                    <blockquote>
                        “After all,” he said, “everyone enjoys a good joke, so
                        it's only fair that they should pay for the privilege.”
                    </blockquote>
                    <h3>The Joke Tax</h3>
                    <p>
                        The king's subjects were not amused. They grumbled and
                        complained, but the king was firm:
                    </p>
                    <ul>
                        <li>1st level of puns: 5 gold coins</li>
                        <li>2nd level of jokes: 10 gold coins</li>
                        <li>3rd level of one-liners : 20 gold coins</li>
                    </ul>
                    <p>
                        As a result, people stopped telling jokes, and the
                        kingdom fell into a gloom. But there was one person who
                        refused to let the king's foolishness get him down: a
                        court jester named Jokester.
                    </p>
                </article>
                <div className="hidden lg:block">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                        <h2 className="text-2xl font-bold mb-4">
                            Related Posts
                        </h2>
                        <ul>
                            <li className="mb-2">
                                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                                    <img
                                        alt="Related post image"
                                        className="object-cover mb-2"
                                        height="200"
                                        src="/placeholder.svg"
                                        style={{
                                            aspectRatio: "200/200",
                                            objectFit: "cover",
                                        }}
                                        width="200"
                                    />
                                    <a
                                        className="text-blue-500 hover:underline"
                                        href="#"
                                    >
                                        The King's New Jester
                                    </a>
                                </div>
                            </li>
                            <li className="mb-2">
                                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                                    <img
                                        alt="Related post image"
                                        className="object-cover mb-2"
                                        height="200"
                                        src="/placeholder.svg"
                                        style={{
                                            aspectRatio: "200/200",
                                            objectFit: "cover",
                                        }}
                                        width="200"
                                    />
                                    <a
                                        className="text-blue-500 hover:underline"
                                        href="#"
                                    >
                                        The Kingdom's First Comedy Club
                                    </a>
                                </div>
                            </li>
                            <li className="mb-2">
                                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                                    <img
                                        alt="Related post image"
                                        className="object-cover mb-2"
                                        height="200"
                                        src="/placeholder.svg"
                                        style={{
                                            aspectRatio: "200/200",
                                            objectFit: "cover",
                                        }}
                                        width="200"
                                    />
                                    <a
                                        className="text-blue-500 hover:underline"
                                        href="#"
                                    >
                                        The Joke Tax: One Year Later
                                    </a>
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
