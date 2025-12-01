// utils/tableFormatter.ts

/**
 * Sanitizes cell content to prevent breaking Markdown table syntax.
 * 1. Replaces pipes (|) with HTML entity.
 * 2. Replaces newlines with <br/> tags.
 * 3. Stringifies objects/arrays if they accidentally slip through.
 */
const sanitizeCell = (content: any): string => {
  if (content === null || content === undefined) return "-";

  let str = "";

  if (Array.isArray(content)) {
    str = content.join(", ");
  } else if (typeof content === "object") {
    // Fallback if AI returns an object instead of a string
    str = Object.values(content).join(" ");
  } else {
    str = String(content);
  }

  return str
    .replace(/\|/g, "&#124;") // Escape pipes so they don't break columns
    .replace(/\r?\n/g, "<br/>") // Convert newlines to HTML breaks
    .trim();
};

/**
 * Converts a camelCase or snake_case key into a Title Case Header
 * e.g. "adverse_effects" -> "Adverse Effects"
 */
const formatHeader = (key: string): string => {
  return key
    .replace(/([A-Z])/g, " $1") // Add space before capitals
    .replace(/[_-]/g, " ") // Replace underscores/dashes with spaces
    .replace(/^\w/, (c) => c.toUpperCase()) // Capitalize first letter
    .trim();
};

/**
 * UNIVERSAL TABLE GENERATOR
 * Dynamically creates a table from ANY array of objects.
 */
export function generateDynamicTable(data: any[]): string {
  if (!Array.isArray(data) || data.length === 0) return "";

  // 1. Discovery Phase: Find all unique keys across ALL rows
  // (This handles cases where the AI omits a field in one row but includes it in another)
  const allKeys = new Set<string>();
  data.forEach((item) => {
    if (typeof item === "object" && item !== null) {
      Object.keys(item).forEach((k) => allKeys.add(k));
    }
  });

  if (allKeys.size === 0) return "";

  const keys = Array.from(allKeys);

  // 2. Header Generation
  const headers = keys.map(formatHeader);
  const headerRow = `| ${headers.join(" | ")} |`;
  const separatorRow = `| ${headers.map(() => "---").join(" | ")} |`;

  // 3. Row Generation
  const rows = data.map((item) => {
    const cells = keys.map((key) => {
      const val = item[key];
      return sanitizeCell(val);
    });
    return `| ${cells.join(" | ")} |`;
  });

  return `\n${headerRow}\n${separatorRow}\n${rows.join("\n")}\n`;
}

/**
 * Main Processor: Scans markdown for JSON blocks and converts them.
 */
export function embedTablesInMarkdown(markdown: string): string {
  if (!markdown) return "";

  // Robust Pattern: Matches ```json [CONTENT] ```
  // Captures the content non-greedily
  const jsonBlockPattern = /```json\s*([\s\S]*?)\s*```/g;

  return markdown.replace(jsonBlockPattern, (match, jsonContent) => {
    try {
      // 1. Attempt to parse the JSON
      // We use a lenient approach: if it fails, we try to find the first [ and last ]
      let parsedData: any;

      try {
        parsedData = JSON.parse(jsonContent);
      } catch (e) {
        // Fallback: Try to extract just the array part if the AI added extra text
        const arrayStart = jsonContent.indexOf("[");
        const arrayEnd = jsonContent.lastIndexOf("]");
        if (arrayStart > -1 && arrayEnd > -1) {
          const arrayStr = jsonContent.substring(arrayStart, arrayEnd + 1);
          parsedData = JSON.parse(arrayStr);
        } else {
          // If it's an object wrapping an array { "meds": [...] }
          const objStart = jsonContent.indexOf("{");
          const objEnd = jsonContent.lastIndexOf("}");
          if (objStart > -1 && objEnd > -1) {
            const objStr = jsonContent.substring(objStart, objEnd + 1);
            const tempObj = JSON.parse(objStr);
            // Find the first array value
            const arrayKey = Object.keys(tempObj).find((k) =>
              Array.isArray(tempObj[k])
            );
            if (arrayKey) parsedData = tempObj[arrayKey];
          }
        }
      }

      // 2. Validate Data Structure
      let tableData: any[] = [];

      if (Array.isArray(parsedData)) {
        tableData = parsedData;
      } else if (typeof parsedData === "object" && parsedData !== null) {
        // If it's { "medications": [...] }, extract the array
        const key = Object.keys(parsedData).find((k) =>
          Array.isArray(parsedData[k])
        );
        if (key) tableData = parsedData[key];
      }

      // 3. Generate Table
      if (tableData.length > 0) {
        return generateDynamicTable(tableData);
      }

      return match; // Return original if no valid data found
    } catch (e) {
      console.warn("Table generation failed for block:", e);
      return match; // Return original block on error
    }
  });
}
