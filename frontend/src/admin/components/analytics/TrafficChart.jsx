import React, { memo, useId } from "react";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

export const TrafficChart = memo(({ data = [] }) => {
    const gradientId = useId();

    const safeData = Array.isArray(data) ? data : [];

    if (!safeData.length) {
        return (
            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm h-[400px] flex items-center justify-center text-gray-400 text-sm font-bold">
                No traffic data available
            </div>
        );
    }

    return (
        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm h-[400px]">
            <div className="mb-6">
                <h3 className="text-sm font-black uppercase tracking-widest text-gray-500">
                    Traffic Ingestion
                </h3>
                <p className="text-[10px] font-bold text-gray-400 mt-1">
                    Weighted Visit Distributions
                </p>
            </div>

            <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={safeData}>
                    <defs>
                        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                    </defs>

                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />

                    <XAxis
                        dataKey="date"
                        tickFormatter={(v) => v?.slice?.(5) || v}
                        axisLine={false}
                        tickLine={false}
                    />

                    <YAxis
                        tickFormatter={(v) => v.toLocaleString()}
                        axisLine={false}
                        tickLine={false}
                    />

                    <Tooltip
                        formatter={(value) => value.toLocaleString()}
                        labelFormatter={(label) => `Date: ${label}`}
                        contentStyle={{
                            borderRadius: "16px",
                            border: "none",
                            fontSize: "12px",
                            fontWeight: "bold"
                        }}
                    />

                    <Area
                        type="monotone"
                        dataKey="visits"
                        stroke="#3b82f6"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill={`url(#${gradientId})`}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
});