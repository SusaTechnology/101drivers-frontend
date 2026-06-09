import React from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, LogIn, Home } from "lucide-react";

export function DriverApplicationSubmitted() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
      <div className="max-w-2xl mx-auto pt-10">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-lg">
          <div className="relative bg-gradient-to-br from-lime-500/20 via-lime-500/10 to-transparent py-12 px-6 sm:px-10">
            <div className="relative flex flex-col items-center text-center">
              <div className="relative mb-6">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-lime-400 to-lime-500 flex items-center justify-center shadow-lg shadow-lime-500/30">
                  <CheckCircle className="w-12 h-12 text-white" />
                </div>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white">
                Registration Complete!
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-400 mt-3 max-w-md">
                Your account has been created and added to the waitlist. An
                administrator will review your information and invite you to
                complete your application.
              </p>
              <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <Clock className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Waitlisted
                </span>
              </div>
            </div>
          </div>
          <div className="p-6 sm:p-10">
            <div className="flex flex-col sm:flex-row gap-3">
              <Link to="/driver-signin" className="flex-1">
                <Button className="w-full h-12 rounded-2xl font-bold bg-slate-900 text-white dark:bg-white dark:text-slate-950">
                  <LogIn className="w-5 h-5 mr-2" />
                  Go to Sign In
                </Button>
              </Link>
              <Link to="/" className="flex-1">
                <Button
                  variant="outline"
                  className="w-full h-12 rounded-2xl font-bold"
                >
                  <Home className="w-5 h-5 mr-2" />
                  Back to Home
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
