#!/usr/bin/env node
/**
 * Automated migration script to replace common CSSProperties with Tailwind classes
 * Usage: node migrate-to-tailwind.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Common CSSProperties → Tailwind replacements
const STYLE_REPLACEMENTS = [
	// Typography
	{ pattern: /\bfontWeight:\s*["']bold["']/g, tailwind: 'font-bold', prop: 'fontWeight' },
	{ pattern: /\bcolor:\s*["']black["']/g, tailwind: 'text-black', prop: 'color' },
	{ pattern: /\bcolor:\s*["']white["']/g, tailwind: 'text-white', prop: 'color' },
	{ pattern: /\bcolor:\s*["']grey["']/g, tailwind: 'text-gray-500', prop: 'color' },
	{ pattern: /\bcolor:\s*["']gray["']/g, tailwind: 'text-gray-500', prop: 'color' },

	// Background colors
	{ pattern: /\bbackgroundColor:\s*["']white["']/g, tailwind: 'bg-white', prop: 'backgroundColor' },
	{ pattern: /\bbackgroundColor:\s*["']black["']/g, tailwind: 'bg-black', prop: 'backgroundColor' },

	// Cursor
	{ pattern: /\bcursor:\s*["']pointer["']/g, tailwind: 'cursor-pointer', prop: 'cursor' },

	// Text decoration
	{ pattern: /\btextDecoration:\s*["']underline["']/g, tailwind: 'underline', prop: 'textDecoration' },

	// Display
	{ pattern: /\bdisplay:\s*["']flex["']/g, tailwind: 'flex', prop: 'display' },

	// Flex direction
	{ pattern: /\bflexDirection:\s*["']row["']/g, tailwind: 'flex-row', prop: 'flexDirection' },
	{ pattern: /\bflexDirection:\s*["']column["']/g, tailwind: 'flex-col', prop: 'flexDirection' },

	// Align items
	{ pattern: /\balignItems:\s*["']center["']/g, tailwind: 'items-center', prop: 'alignItems' },
	{ pattern: /\balignItems:\s*["']start["']/g, tailwind: 'items-start', prop: 'alignItems' },
	{ pattern: /\balignItems:\s*["']end["']/g, tailwind: 'items-end', prop: 'alignItems' },

	// Justify content
	{ pattern: /\bjustifyContent:\s*["']center["']/g, tailwind: 'justify-center', prop: 'justifyContent' },
	{ pattern: /\bjustifyContent:\s*["']space-between["']/g, tailwind: 'justify-between', prop: 'justifyContent' },
	{ pattern: /\bjustifyContent:\s*["']space-around["']/g, tailwind: 'justify-around', prop: 'justifyContent' },
	{ pattern: /\bjustifyContent:\s*["']end["']/g, tailwind: 'justify-end', prop: 'justifyContent' },
];

// Import removals after migration
const IMPORTS_TO_REMOVE = [
	'boldFont',
	'blackFont',
	'whiteFont',
	'blackBoldFont',
	'linkCursor',
	'linkesque',
	'centerAlignedFlex',
	'centerAlignedFlexRow',
	'centerAlignedFlexCol',
	'flexSpaceAround',
];

function findTsxFiles(dir, fileList = []) {
	const files = fs.readdirSync(dir);

	files.forEach(file => {
		const filePath = path.join(dir, file);
		const stat = fs.statSync(filePath);

		if (stat.isDirectory()) {
			// Skip node_modules
			if (file !== 'node_modules') {
				findTsxFiles(filePath, fileList);
			}
		} else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
			fileList.push(filePath);
		}
	});

	return fileList;
}

function analyzeFile(content) {
	const analysis = {
		hasStyleImports: false,
		hasInlineStyles: false,
		potentialReplacements: [],
	};

	// Check for style imports
	if (content.match(/import.*from.*['"](\.\.\/)*helpers\/styles['"]/)) {
		analysis.hasStyleImports = true;
	}

	// Check for inline style objects
	if (content.match(/style=\{[^}]*\}/)) {
		analysis.hasInlineStyles = true;
	}

	// Find potential replacements
	STYLE_REPLACEMENTS.forEach(({ pattern, tailwind, prop }) => {
		const matches = content.match(pattern);
		if (matches) {
			analysis.potentialReplacements.push({
				count: matches.length,
				prop,
				tailwind,
			});
		}
	});

	return analysis;
}

function scanCodebase() {
	console.log('🔍 Scanning codebase for migration opportunities...\n');

	const srcDir = path.join(__dirname, 'src');
	const files = findTsxFiles(srcDir);

	let totalFiles = 0;
	let filesWithStyles = 0;
	let totalReplacements = 0;

	const report = [];

	files.forEach(filePath => {
		const content = fs.readFileSync(filePath, 'utf-8');
		const analysis = analyzeFile(content);

		totalFiles++;

		if (analysis.hasStyleImports || analysis.potentialReplacements.length > 0) {
			filesWithStyles++;
			const replacementCount = analysis.potentialReplacements.reduce((sum, r) => sum + r.count, 0);
			totalReplacements += replacementCount;

			report.push({
				file: path.relative(__dirname, filePath),
				...analysis,
				replacementCount,
			});
		}
	});

	// Sort by replacement count descending
	report.sort((a, b) => b.replacementCount - a.replacementCount);

	console.log(`📊 Scan Results:`);
	console.log(`   Total files: ${totalFiles}`);
	console.log(`   Files with style code: ${filesWithStyles}`);
	console.log(`   Total potential replacements: ${totalReplacements}\n`);

	console.log(`📋 Top 15 files by replacement count:\n`);
	report.slice(0, 15).forEach(({ file, replacementCount, potentialReplacements }) => {
		console.log(`   ${file} (${replacementCount} replacements)`);
		potentialReplacements.forEach(({ count, prop, tailwind }) => {
			console.log(`      - ${prop} → ${tailwind} (${count}x)`);
		});
	});

	return { totalFiles, filesWithStyles, totalReplacements, report };
}

// Run scan
const results = scanCodebase();

console.log('\n✅ Scan complete!');
console.log('\n💡 Next steps:');
console.log('   1. Review the report above');
console.log('   2. Run targeted migrations on high-impact files');
console.log('   3. Test after each batch of changes');
console.log('   4. Commit incrementally\n');
