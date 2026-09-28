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

export default function ContactFormEmail({
    message,
    senderEmail,
    topic,
}: ContactFormEmailProps) {
    const route = contactCopy.topics[topic].title;
    return (
        <Html>
            <Head />
            <Preview>{`New message from your portfolio site: ${route}`}</Preview>
            <Tailwind>
                <Body className="bg-gray-100 text-black">
                    <Container>
                        <Section className="bg-white border border-black/10 my-10 px-10 py-4 rounded-md">
                            <Heading className="leading-tight">
                                You received the following message from the
                                contact form
                            </Heading>
                            <Text>Topic: {route}</Text>
                            <Text>{message}</Text>
                            <Hr />
                            <Text>The sender's email is: {senderEmail}</Text>
                        </Section>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
}
