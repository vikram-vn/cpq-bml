<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
    <!-- Top-level comment describing stylesheet -->
    <xsl:template match="/">
        <config>
            <!-- Embedded raw configuration snippet -->
            <raw-data> <![CDATA[
          function calculateDiscount(qty, price) {
            return qty > 10 ? price * 0.15 : 0;
          }
        ]]> </raw-data>
        </config>
    </xsl:template>
</xsl:stylesheet>
