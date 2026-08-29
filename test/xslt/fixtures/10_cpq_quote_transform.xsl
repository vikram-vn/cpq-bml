<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
    <xsl:param name="showTax" select="'true'"/>
    <xsl:template match="/bm_quote">
        <div class="cpq-quote-summary">
            <h2>Quote #: 
                <xsl:value-of select="quote_number"/>
            </h2>
            <table class="line-items-table">
                <thead>
                    <tr>
                        <th>Part Number</th>
                        <th>Description</th>
                        <th>Qty</th>
                        <th>Price</th>
                    </tr>
                </thead>
                <tbody>
                    <xsl:for-each select="transaction_line">
                        <tr>
                            <td>
                                <xsl:value-of select="_part_number"/>
                            </td>
                            <td>
                                <xsl:value-of select="_part_desc"/>
                            </td>
                            <td>
                                <xsl:value-of select="_price_quantity"/>
                            </td>
                            <td>
                                <xsl:value-of select="_price_unit_price"/>
                            </td>
                        </tr>
                    </xsl:for-each>
                </tbody>
            </table>
            <div class="total-row">
                <strong>Total Amount: </strong>
                <span>
                    <xsl:value-of select="total_amount_c"/>
                </span>
            </div>
        </div>
    </xsl:template>
</xsl:stylesheet>
