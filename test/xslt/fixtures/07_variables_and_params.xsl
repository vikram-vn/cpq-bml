<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
    <xsl:param name="taxRate" select="0.08"/>
    <xsl:param name="currencySymbol" select="'$'"/>
    <xsl:template match="/invoice">
        <xsl:variable name="subtotal" select="sum(line/amount)"/>
        <xsl:variable name="tax" select="$subtotal * $taxRate"/>
        <invoice-summary>
            <subtotal>
                <xsl:value-of select="concat($currencySymbol, $subtotal)"/>
            </subtotal>
            <tax>
                <xsl:value-of select="concat($currencySymbol, $tax)"/>
            </tax>
            <total>
                <xsl:value-of select="concat($currencySymbol, $subtotal + $tax)"/>
            </total>
        </invoice-summary>
    </xsl:template>
</xsl:stylesheet>
