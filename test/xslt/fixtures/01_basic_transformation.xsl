<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
    <xsl:output method="xml" indent="yes"/>
    <xsl:template match="/">
        <catalog>
            <title>Product Catalog</title>
            <xsl:apply-templates select="catalog/product"/>
        </catalog>
    </xsl:template>
    <xsl:template match="product">
        <item id="{@id}">
            <name>
                <xsl:value-of select="name"/>
            </name>
            <price>
                <xsl:value-of select="price"/>
            </price>
        </item>
    </xsl:template>
</xsl:stylesheet>