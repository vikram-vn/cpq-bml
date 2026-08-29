<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
    <xsl:template match="/order">
        <sorted-items>
            <xsl:for-each select="line_item">
                <xsl:sort select="unit_price" data-type="number" order="descending"/>
                <item rank="{position()}">
                    <part>
                        <xsl:value-of select="part_number"/>
                    </part>
                    <cost>
                        <xsl:value-of select="unit_price"/>
                    </cost>
                </item>
            </xsl:for-each>
        </sorted-items>
    </xsl:template>
</xsl:stylesheet>
