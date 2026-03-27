module.exports = [
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[project]/src/app/api/pricingConfigs/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DELETE",
    ()=>DELETE,
    "GET",
    ()=>GET,
    "POST",
    ()=>POST
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
;
// Mock database for pricing configurations
const pricingConfigs = new Map();
function generateId() {
    return `pc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
async function GET(request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (id) {
        const config = pricingConfigs.get(id);
        if (!config) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: 'Configuration not found'
            }, {
                status: 404
            });
        }
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json(config);
    }
    // Return all configs as array
    const configs = Array.from(pricingConfigs.values());
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json(configs);
}
async function POST(request) {
    try {
        const body = await request.json();
        // Validate required fields
        const { name, pricingMode, baseFee, insuranceFee, tiers, categoryRules } = body;
        if (!name || typeof name !== 'string') {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: 'Configuration name is required'
            }, {
                status: 400
            });
        }
        if (![
            'CATEGORY_ABC',
            'FLAT_TIER',
            'PER_MILE'
        ].includes(pricingMode)) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: 'Invalid pricing mode'
            }, {
                status: 400
            });
        }
        // Validate based on pricing mode
        if (pricingMode === 'CATEGORY_ABC') {
            if (!Array.isArray(categoryRules) || categoryRules.length === 0) {
                return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                    error: 'Category rules are required for CATEGORY_ABC mode'
                }, {
                    status: 400
                });
            }
            if (Array.isArray(tiers) && tiers.length > 0) {
                return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                    error: 'Tiers must be empty for CATEGORY_ABC mode'
                }, {
                    status: 400
                });
            }
            // Verify all categories A, B, C are present
            const categories = categoryRules.map((r)=>r.category);
            if (![
                'A',
                'B',
                'C'
            ].every((c)=>categories.includes(c))) {
                return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                    error: 'Categories A, B, and C are all required'
                }, {
                    status: 400
                });
            }
        }
        if (pricingMode === 'FLAT_TIER') {
            if (!Array.isArray(tiers) || tiers.length === 0) {
                return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                    error: 'Tiers are required for FLAT_TIER mode'
                }, {
                    status: 400
                });
            }
            if (Array.isArray(categoryRules) && categoryRules.length > 0) {
                return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                    error: 'Category rules must be empty for FLAT_TIER mode'
                }, {
                    status: 400
                });
            }
        }
        if (pricingMode === 'PER_MILE') {
            if (Array.isArray(tiers) && tiers.length > 0) {
                return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                    error: 'Tiers must be empty for PER_MILE mode'
                }, {
                    status: 400
                });
            }
            if (Array.isArray(categoryRules) && categoryRules.length > 0) {
                return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                    error: 'Category rules must be empty for PER_MILE mode'
                }, {
                    status: 400
                });
            }
        }
        // Check if this is an update (has id) or create
        const isUpdate = body.id && pricingConfigs.has(body.id);
        const now = new Date().toISOString();
        const config = {
            id: body.id || generateId(),
            name,
            pricingMode,
            baseFee: Number(baseFee) || 0,
            insuranceFee: Number(insuranceFee) || 0,
            transactionFeePct: Number(body.transactionFeePct) || undefined,
            transactionFeeFixed: Number(body.transactionFeeFixed) || undefined,
            feePassThrough: body.feePassThrough ?? true,
            driverSharePct: Number(body.driverSharePct) || 60,
            tiers: tiers || [],
            categoryRules: categoryRules || [],
            isActive: body.isActive ?? false,
            createdAt: isUpdate ? pricingConfigs.get(body.id)?.createdAt || now : now,
            updatedAt: now
        };
        // Save to "database"
        pricingConfigs.set(config.id, config);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            success: true,
            message: isUpdate ? 'Configuration updated successfully' : 'Configuration created successfully',
            data: config
        });
    } catch (error) {
        console.error('Error processing pricing config:', error);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: 'Invalid request body'
        }, {
            status: 400
        });
    }
}
async function DELETE(request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: 'Configuration ID is required'
        }, {
            status: 400
        });
    }
    if (!pricingConfigs.has(id)) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: 'Configuration not found'
        }, {
            status: 404
        });
    }
    pricingConfigs.delete(id);
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        success: true,
        message: 'Configuration deleted successfully'
    });
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__a3651e17._.js.map