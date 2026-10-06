import React from "react";
import {
    Html,
    Body,
    Head,
    Heading,
    Hr,
    Container,
    Preview,
    Section,
    Tailwind,
    Text,
} from "react-email";
import { contactCopy } from "@/lib/copy";
import type { ContactTopic } from "@/lib/contact";

type ContactFormEmailProps = {
    message: string;
    senderEmail: string;
    /** The contact route the sender picked (Hello when none). */
    topic: ContactTopic;
};

const HEADING = "You received the following message from the contact form";

/**
 * The same email as plain text, for clients that show it and for the
 * multipart's fallback: the message keeps its line breaks as written.
 */
export function contactFormEmailText({
    message,
    senderEmail,
    topic,
}: ContactFormEmailProps): string {
    const route = contactCopy.topics[topic].name;
    return [
        HEADING,
        `Topic: ${route}`,
        message,
        "---",
        `The sender's email is: ${senderEmail}`,
    ].join("\n\n");
}

export default function ContactFormEmail({
    message,
    senderEmail,
    topic,
}: ContactFormEmailProps) {
    const route = contactCopy.topics[topic].name;
    return (
        <Html>
            <Head />
            <Preview>{`New message from your portfolio site: ${route}`}</Preview>
            <Tailwind>
                <Body className="bg-gray-100 text-black">
                    <Container>
                        <Section className="bg-white border border-black/10 my-10 px-10 py-4 rounded-md">
                            <Heading className="leading-tight">
                                {HEADING}
                            </Heading>
                            <Text>Topic: {route}</Text>
                            {/* The sender's paragraphs and line breaks, as
                                written: HTML would run them together. */}
                            <Text style={{ whiteSpace: "pre-wrap" }}>
                                {message}
                            </Text>
                            <Hr />
                            <Text>The sender's email is: {senderEmail}</Text>
                        </Section>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
}
