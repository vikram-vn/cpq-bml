<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
    <xsl:output method="html" indent="yes" encoding="UTF-8"/>
    <xsl:template match="/article">
        <html>
            <head>
                <title>
                    <xsl:value-of select="title"/>
                </title>
            </head>
            <body>
                <h1>
                    <xsl:value-of select="title"/>
                </h1>
                <p>
                    <b>Author: </b>
                    <span>
                        <xsl:value-of select="author"/>
                    </span>
                </p>
                <div class="content">
                    <xsl:value-of select="body"/>
                </div>
            </body>
        </html>
    </xsl:template>
</xsl:stylesheet>
