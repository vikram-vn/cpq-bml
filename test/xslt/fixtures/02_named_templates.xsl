<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
    <xsl:template match="/">
        <root>
            <xsl:call-template name="FormatCurrency">
                <xsl:with-param name="amount" select="1250.75"/>
                <xsl:with-param name="currency" select="'USD'"/>
            </xsl:call-template>
        </root>
    </xsl:template>
    <xsl:template name="FormatCurrency">
        <xsl:param name="amount" select="0.0"/>
        <xsl:param name="currency" select="'USD'"/>
        <formatted-price>
            <xsl:value-of select="concat($currency, ' ', $amount)"/>
        </formatted-price>
    </xsl:template>
</xsl:stylesheet>
