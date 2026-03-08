"use client";

import { useState } from "react";
import { DollarSign, X } from "lucide-react";
import { Study } from "@/types";
import { supabase } from "@/lib/supabase";

const PRESET_AMOUNTS = [10, 50, 100, 500, 1000];

export default function FundModal({
  study,
  currentFunded,
  onClose,
  onFund,
}: {
  study: Study;
  currentFunded: number;
  onClose: () => void;
  onFund: (amount: number) => void;
}) {
  const [amount, setAmount] = useState<number>(50);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleFund() {
    setSubmitting(true);

    // Cosmetic funding — just update the funded_amount in Supabase
    const newTotal = currentFunded + amount;
    await supabase
      .from("experiments")
      .update({
        funded_amount: newTotal,
        status: newTotal >= study.funding_goal ? "funded" : "proposed",
      })
      .eq("id", study.id);

    onFund(amount);
    setDone(true);
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Fund Study</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {done ? (
          <div className="text-center py-6">
            <div className="text-4xl mb-2">🎉</div>
            <p className="text-lg font-semibold text-green-700">
              ${amount.toLocaleString()} pledged!
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Thank you for supporting science.
            </p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-4">{study.title}</p>

            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 bg-gray-100 rounded-full h-3">
                <div
                  className="bg-green-500 h-3 rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (currentFunded / study.funding_goal) * 100)}%`,
                  }}
                />
              </div>
              <span className="text-xs text-gray-500 whitespace-nowrap">
                ${currentFunded.toLocaleString()} / ${study.funding_goal.toLocaleString()}
              </span>
            </div>

            <div className="flex gap-2 mb-4 flex-wrap">
              {PRESET_AMOUNTS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => setAmount(preset)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    amount === preset
                      ? "border-green-500 bg-green-50 text-green-700"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  ${preset}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 mb-4">
              <DollarSign size={16} className="text-gray-400" />
              <input
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value) || 0))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <button
              onClick={handleFund}
              disabled={submitting}
              className="w-full py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? "Processing..." : `Pledge $${amount.toLocaleString()}`}
            </button>

            <p className="text-xs text-gray-400 mt-2 text-center">
              Demo mode — no real payment processed
            </p>
          </>
        )}
      </div>
    </div>
  );
}
