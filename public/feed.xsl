<?xml version="1.0" encoding="UTF-8"?>
<!--
    How a browser shows /feed.xml (lib/feed.ts names this stylesheet; a feed
    reader ignores it): a plain page in the site's Void colours and the
    system's own fonts, with the feed's title, one line on what the page is
    for, and the posts, each linking to its page. Everything comes from the
    feed itself; nothing else is loaded.
-->
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
    <xsl:output method="html" encoding="UTF-8" indent="yes" doctype-system="about:legacy-compat"/>
    <xsl:template match="/">
        <html lang="en">
            <head>
                <meta charset="utf-8"/>
                <meta name="viewport" content="width=device-width, initial-scale=1"/>
                <meta name="robots" content="noindex"/>
                <title><xsl:value-of select="rss/channel/title"/></title>
                <style>
                    :root {
                        color-scheme: dark;
                        background: #050507;
                        color: #ece8df;
                        font: 400 1.0625rem / 1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
                    }
                    body {
                        max-width: 40rem;
                        margin: 0 auto;
                        padding: 4rem 1rem 6rem;
                    }
                    h1 {
                        margin: 0;
                        font-size: 2rem;
                        font-weight: 400;
                        line-height: 1.15;
                    }
                    .note {
                        margin: 0.75rem 0 3rem;
                        color: #bcb7ad;
                    }
                    ol {
                        margin: 0;
                        padding: 0;
                        border-bottom: 1px solid #1f1f25;
                        list-style: none;
                    }
                    li {
                        padding: 1.5rem 0;
                        border-top: 1px solid #1f1f25;
                    }
                    .date {
                        color: #bcb7ad;
                        font: 400 0.8125rem / 1.4 ui-monospace, "SF Mono", Menlo, Consolas, monospace;
                    }
                    h2 {
                        margin: 0.4rem 0 0;
                        font-size: 1.25rem;
                        font-weight: 400;
                        line-height: 1.3;
                    }
                    a {
                        color: inherit;
                        text-decoration-color: #ff5a1f;
                        text-decoration-thickness: 1px;
                        text-underline-offset: 0.22em;
                    }
                    a:hover {
                        text-decoration-thickness: 2px;
                    }
                    a:focus-visible {
                        outline: 2px solid #ff5a1f;
                        outline-offset: 3px;
                    }
                    li p {
                        margin: 0.5rem 0 0;
                        color: #bcb7ad;
                        font-family: ui-serif, Georgia, serif;
                    }
                </style>
            </head>
            <body>
                <main>
                    <h1><xsl:value-of select="rss/channel/title"/></h1>
                    <p class="note">Copy this page’s address into a feed reader.</p>
                    <ol>
                        <xsl:for-each select="rss/channel/item">
                            <li>
                                <!-- "Mon, 02 Mar 2026 00:00:00 GMT" → "2 Mar 2026", as the site prints it. -->
                                <xsl:variable name="date" select="substring(pubDate, 6, 11)"/>
                                <span class="date">
                                    <xsl:choose>
                                        <xsl:when test="starts-with($date, '0')">
                                            <xsl:value-of select="substring($date, 2)"/>
                                        </xsl:when>
                                        <xsl:otherwise>
                                            <xsl:value-of select="$date"/>
                                        </xsl:otherwise>
                                    </xsl:choose>
                                </span>
                                <h2>
                                    <a href="{link}">
                                        <xsl:value-of select="title"/>
                                    </a>
                                </h2>
                                <xsl:if test="description != ''">
                                    <p><xsl:value-of select="description"/></p>
                                </xsl:if>
                            </li>
                        </xsl:for-each>
                    </ol>
                </main>
            </body>
        </html>
    </xsl:template>
</xsl:stylesheet>
