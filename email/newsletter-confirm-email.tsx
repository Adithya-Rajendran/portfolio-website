import React from "react";
import {
    Html,
    Body,
    Button,
    Head,
    Heading,
    Hr,
    Container,
    Preview,
    Section,
    Tailwind,
    Text,
} from "react-email";

type NewsletterConfirmEmailProps = {
    confirmUrl: string;
};

export default function NewsletterConfirmEmail({
    confirmUrl,
}: NewsletterConfirmEmailProps) {
    return (
        <Html>
            <Head />
            <Preview>Confirm your subscription to the newsletter</Preview>
            <Tailwind>
                <Body className="bg-gray-100 text-black">
                    <Container>
                        <Section className="bg-white border border-black/10 my-10 px-10 py-6 rounded-md">
                            <Heading className="leading-tight">
                                Confirm your subscription
                            </Heading>
                            <Text>
                                You (or someone using your address) asked to
                                receive new posts from adithya-rajendran.com —
                                deep technical write-ups on infrastructure,
                                Kubernetes, and security, roughly every two
                                weeks. It's free, and you can unsubscribe at any
                                time.
                            </Text>
                            <Text>
                                Click the button below to confirm. The link
                                expires in 48 hours.
                            </Text>
                            <Button
                                href={confirmUrl}
                                className="bg-emerald-600 text-white px-6 py-3 rounded-md font-semibold"
                            >
                                Confirm subscription
                            </Button>
                            <Text className="text-sm text-gray-500">
                                Or paste this link into your browser:{" "}
                                {confirmUrl}
                            </Text>
                            <Hr />
                            <Text className="text-sm text-gray-500">
                                If you didn't request this, ignore this email —
                                you won't be subscribed.
                            </Text>
                        </Section>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
}
