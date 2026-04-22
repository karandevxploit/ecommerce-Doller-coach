const fs = require("fs/promises");
const path = require("path");

const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generate = require("@babel/generator").default;

const routesDir = path.join(__dirname, "../routes");

/**
 * CHECK IF safeHandler IMPORT EXISTS
 */
function hasSafeHandlerImport(ast) {
    let found = false;

    traverse(ast, {
        ImportDeclaration(path) {
            if (path.node.source.value.includes("error.middleware")) {
                found = true;
            }
        },
        VariableDeclarator(path) {
            if (
                path.node.init &&
                path.node.init.callee &&
                path.node.init.callee.name === "require" &&
                path.node.init.arguments[0]?.value.includes("error.middleware")
            ) {
                found = true;
            }
        },
    });

    return found;
}

/**
 * ADD IMPORT SAFELY
 */
function addImport(ast) {
    const importNode = parser.parse(
        `const { safeHandler } = require("../middlewares/error.middleware");`
    ).program.body[0];

    ast.program.body.unshift(importNode);
}

/**
 * WRAP ROUTES SAFELY
 */
function wrapRoutes(ast) {
    traverse(ast, {
        CallExpression(path) {
            const callee = path.node.callee;

            if (
                callee.type === "MemberExpression" &&
                callee.object.name === "router"
            ) {
                const args = path.node.arguments;

                if (args.length > 1) {
                    const last = args[args.length - 1];

                    if (
                        last.type === "Identifier" ||
                        last.type === "ArrowFunctionExpression" ||
                        last.type === "FunctionExpression"
                    ) {
                        // Skip if already wrapped
                        if (
                            last.type === "CallExpression" &&
                            last.callee.name === "safeHandler"
                        ) {
                            return;
                        }

                        args[args.length - 1] = {
                            type: "CallExpression",
                            callee: { type: "Identifier", name: "safeHandler" },
                            arguments: [last],
                        };
                    }
                }
            }
        },
    });
}

/**
 * MAIN
 */
(async () => {
    const files = await fs.readdir(routesDir);

    for (const file of files) {
        if (!file.endsWith(".js")) continue;

        const filePath = path.join(routesDir, file);
        const code = await fs.readFile(filePath, "utf8");

        const ast = parser.parse(code, {
            sourceType: "module",
            plugins: ["jsx"],
        });

        const hasImport = hasSafeHandlerImport(ast);

        if (!hasImport) {
            addImport(ast);
        }

        wrapRoutes(ast);

        const output = generate(ast, {}, code);

        await fs.writeFile(filePath, output.code);

        console.log(`✔ Processed ${file}`);
    }

    console.log("✅ All routes hardened safely.");
})();