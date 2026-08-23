<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
    <xsl:template match="/user">
        <xsl:element name="profile">
            <xsl:attribute name="id">
                <xsl:value-of select="@id"/>
            </xsl:attribute>
            <xsl:attribute name="role">
                <xsl:value-of select="role"/>
            </xsl:attribute>
            <link href="https://example.com/users/{@id}" title="{name}"/>
        </xsl:element>
    </xsl:template>
</xsl:stylesheet>
