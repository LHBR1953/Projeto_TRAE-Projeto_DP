const fs = require('fs');
const acorn = require('acorn');
const walk = require('acorn-walk');

let v22Code = fs.readFileSync('app_v22.js', 'utf8');
const ast = acorn.parse(v22Code, {ecmaVersion: 2020, ranges: true, locations: true});

const functionsToMove = [
  'saveBudget',
  'saveBudgetItem',
  'editBudget',
  'editBudgetItem',
  'deleteBudget',
  'deleteBudgetItem',
  'generateBudgetPDF',
  'showBudgetForm',
  'searchBudgets',
  'handleBudgetMasterStatusChange',
  'getBudgetLockInfo',
  'getBudgetItemContext',
  'getSelectedBudgetService',
  'getBudgetsHelpHtml',
  'removeBudgetItem',
  'printBudget',
  'createNewBudgetFromProntuario',
  'viewBudgetFromPatient',
  'getTransactionBudgetRef',
  'viewBudgetPayments',
  'deleteBudgetPayment',
  'recordBudgetPayment',
  'releaseBudgetItem',
  'revertBudgetItem',
  'finalizeBudgetItem'
];

let rangesToRemove = [];
let extractedCode = [];

walk.simple(ast, {
    FunctionDeclaration(node) {
        if (node.id && functionsToMove.includes(node.id.name)) {
            rangesToRemove.push([node.start, node.end]);
            extractedCode.push(v22Code.substring(node.start, node.end));
        }
    },
    ExpressionStatement(node) {
        if (node.expression.type === 'AssignmentExpression' &&
            node.expression.left.type === 'MemberExpression' &&
            node.expression.left.object.name === 'window' &&
            node.expression.left.property.name &&
            functionsToMove.includes(node.expression.left.property.name)) {
            
            rangesToRemove.push([node.start, node.end]);
            extractedCode.push(v22Code.substring(node.start, node.end));
        }
    }
});

// Sort ranges in descending order so removal doesn't shift indices
rangesToRemove.sort((a, b) => b[0] - a[0]);

// Ensure no overlapping ranges
let filteredRanges = [];
let lastStart = Infinity;
for (let r of rangesToRemove) {
    if (r[1] <= lastStart) {
        filteredRanges.push(r);
        lastStart = r[0];
    }
}

for (let r of filteredRanges) {
    v22Code = v22Code.substring(0, r[0]) + v22Code.substring(r[1]);
}

fs.writeFileSync('app_v22.js', v22Code, 'utf8');

let orcCode = fs.readFileSync('app_orcamentos.js', 'utf8');
orcCode += '\n// --- MOVED BUDGET FUNCTIONS ---\n' + extractedCode.join('\n\n') + '\n';
fs.writeFileSync('app_orcamentos.js', orcCode, 'utf8');

console.log('Successfully moved', extractedCode.length, 'functions to app_orcamentos.js');
