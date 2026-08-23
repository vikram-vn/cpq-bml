<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
    <xsl:template match="/quote">
        <status-summary>
            <xsl:choose>
                <xsl:when test="totalPrice > 10000">
                    <discount-tier>Executive Approval Required</discount-tier>
                </xsl:when>
                <xsl:when test="totalPrice > 5000">
                    <discount-tier>Manager Approval Required</discount-tier>
                </xsl:when>
                <xsl:otherwise>
                    <discount-tier>Standard Pricing</discount-tier>
                </xsl:otherwise>
            </xsl:choose>
            <xsl:if test="isTaxExempt = 'true'">
                <tax-status>Exempt</tax-status>
            </xsl:if>
        </status-summary>
    </xsl:template>
</xsl:stylesheet>
