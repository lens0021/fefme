#!/usr/bin/env node
/**
 * Automatically migrate specific files to Tailwind CSS
 * Usage: node auto-migrate.js <file1> <file2> ...
 */

const fs = require("node:fs");
const path = require("node:path");

// Files to migrate (can be passed as arguments)
const filesToMigrate =
	process.argv.slice(2).length > 0
		? process.argv.slice(2)
		: [
				"src/components/helpers/ErrorHandler.tsx",
				"src/components/algorithm/WeightSetter.tsx",
				"src/components/algorithm/FeedFiltersAccordionSection.tsx",
				"src/components/ApiErrorsPanel.tsx",
				"src/components/algorithm/FilterAccordionSection.tsx",
				"src/components/experimental/StatsModal.tsx",
				"src/components/status/PreviewCard.tsx",
				"src/components/status/Status.tsx",
			];

/**
 * Convert inline style object to Tailwind classes
 * Example: { color: "black", fontWeight: "bold" } → "text-black font-bold"
 */
function convertStylesToTailwind(styleString) {
	const conversions = {
		'fontWeight: "bold"': "font-bold",
		"fontWeight: 'bold'": "font-bold",
		'color: "black"': "text-black",
		"color: 'black'": "text-black",
		'color: "white"': "text-white",
		"color: 'white'": "text-white",
		'color: "grey"': "text-gray-500",
		"color: 'grey'": "text-gray-500",
		'color: "gray"': "text-gray-500",
		"color: 'gray'": "text-gray-500",
		'backgroundColor: "white"': "bg-white",
		"backgroundColor: 'white'": "bg-white",
		'backgroundColor: "black"': "bg-black",
		"backgroundColor: 'black'": "bg-black",
		'cursor: "pointer"': "cursor-pointer",
		"cursor: 'pointer'": "cursor-pointer",
		'textDecoration: "underline"': "underline",
		"textDecoration: 'underline'": "underline",
		'display: "flex"': "flex",
		"display: 'flex'": "flex",
		'flexDirection: "row"': "flex-row",
		"flexDirection: 'row'": "flex-row",
		'flexDirection: "column"': "flex-col",
		"flexDirection: 'column'": "flex-col",
		'alignItems: "center"': "items-center",
		"alignItems: 'center'": "items-center",
		'alignItems: "start"': "items-start",
		"alignItems: 'start'": "items-start",
		'alignItems: "end"': "items-end",
		"alignItems: 'end'": "items-end",
		'justifyContent: "center"': "justify-center",
		"justifyContent: 'center'": "justify-center",
		'justifyContent: "space-between"': "justify-between",
		"justifyContent: 'space-between'": "justify-between",
		'justifyContent: "space-around"': "justify-around",
		"justifyContent: 'space-around'": "justify-around",
		'justifyContent: "end"': "justify-end",
		"justifyContent: 'end'": "justify-end",
	};

	let result = styleString;
	const tailwindClasses = [];

	// Extract each convertible property
	for (const [cssProp, tailwindClass] of Object.entries(conversions)) {
		if (result.includes(cssProp)) {
			tailwindClasses.push(tailwindClass);
			result = result.replace(cssProp, "");
		}
	}

	// Clean up the remaining style object
	result = result.replace(/,\s*,/g, ","); // Remove double commas
	result = result.replace(/{\s*,/g, "{"); // Remove leading comma
	result = result.replace(/,\s*}/g, "}"); // Remove trailing comma
	result = result.replace(/\.\.\.\s*,/g, "..."); // Clean spread operator
	result = result.trim();

	// If the style object is now empty, replace with just className
	const isEmpty =
		result === "{}" || result === "{ }" || result.match(/^\{\s*\}$/);

	return {
		tailwindClasses: tailwindClasses.join(" "),
		remainingStyles: isEmpty ? "" : result,
	};
}

/**
 * Migrate a single file
 */
function migrateFile(filePath) {
	const fullPath = path.join(__dirname, filePath);

	if (!fs.existsSync(fullPath)) {
		console.log(`   ❌ File not found: ${filePath}`);
		return { success: false };
	}

	const originalContent = fs.readFileSync(fullPath, "utf-8");
	let content = originalContent;
	let changes = 0;

	// Pattern 1: Simple style={{ prop: value }} replacements
	const simpleStylePattern = /style=\{\{([^}]*)\}\}/g;
	let match = simpleStylePattern.exec(originalContent);
	while (match !== null) {
		const styleContent = match[1];
		const { tailwindClasses, remainingStyles } =
			convertStylesToTailwind(styleContent);

		if (tailwindClasses) {
			const original = match[0];
			let replacement;

			if (remainingStyles) {
				// Has both Tailwind and remaining inline styles
				replacement = `className="${tailwindClasses}" style={${remainingStyles}}`;
			} else {
				// Only Tailwind classes
				replacement = `className="${tailwindClasses}"`;
			}

			content = content.replace(original, replacement);
			changes++;
		}
		match = simpleStylePattern.exec(originalContent);
	}

	// Pattern 2: Merge with existing className
	// This is more complex and should be done carefully
	// For now, skip this to avoid breaking existing classNames

	if (changes > 0) {
		fs.writeFileSync(fullPath, content, "utf-8");
		console.log(`   ✅ ${filePath} (${changes} changes)`);
		return { success: true, changes };
	}
	console.log(`   ⚪ ${filePath} (no changes)`);
	return { success: true, changes: 0 };
}

// Main execution
console.log("🚀 Starting automated migration to Tailwind CSS...\n");
console.log(`📁 Migrating ${filesToMigrate.length} files:\n`);

let totalChanges = 0;
let successCount = 0;

for (const file of filesToMigrate) {
	const result = migrateFile(file);
	if (result.success) {
		successCount++;
		totalChanges += result.changes || 0;
	}
}

console.log("\n✨ Migration complete!");
console.log(`   ${successCount}/${filesToMigrate.length} files processed`);
console.log(`   ${totalChanges} style properties converted to Tailwind\n`);

if (totalChanges > 0) {
	console.log("💡 Next steps:");
	console.log("   1. Run: npm run build");
	console.log("   2. Review changes: git diff");
	console.log("   3. Test the application");
	console.log("   4. Commit if everything works\n");
}
