import { Document, Page, StyleSheet, Text } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 48,
    fontSize: 11,
    fontFamily: "Helvetica",
    color: "#111",
    lineHeight: 1.45,
  },
  brand: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  muted: {
    fontSize: 9,
    color: "#555",
    marginBottom: 24,
  },
  heading: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    marginBottom: 12,
  },
  body: {
    marginBottom: 8,
  },
  footer: {
    position: "absolute",
    bottom: 32,
    left: 48,
    right: 48,
    fontSize: 8,
    color: "#777",
  },
});

export type QuotePdfProps = {
  quoteNumber: string;
  companyName: string | null;
  productName: string;
  bodyLines: string[];
  issuedAt: string;
};

/** Customer-facing quote PDF layout (English quote copy). */
export function QuotePdfDocument({
  quoteNumber,
  companyName,
  productName,
  bodyLines,
  issuedAt,
}: QuotePdfProps) {
  return (
    <Document
      title={`${quoteNumber} · ${productName}`}
      author="Santa Technologies"
      subject={`Quote ${quoteNumber}`}
    >
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>Santa Technologies</Text>
        <Text style={styles.muted}>Multirotor Ops · Quote {quoteNumber}</Text>
        <Text style={styles.heading}>
          {productName}
          {companyName ? ` · ${companyName}` : ""}
        </Text>
        {bodyLines.map((line, index) => (
          <Text key={`${index}-${line.slice(0, 12)}`} style={styles.body}>
            {line || " "}
          </Text>
        ))}
        <Text style={styles.footer}>Issued {issuedAt} · Prices excl. VAT · EUR</Text>
      </Page>
    </Document>
  );
}
