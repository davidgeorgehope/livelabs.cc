"use client";

import { useRef } from "react";
import { CertificateData } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Download, Award } from "lucide-react";

interface CertificateProps {
  data: CertificateData;
}

export function Certificate({ data }: CertificateProps) {
  const certificateRef = useRef<HTMLDivElement>(null);

  const handleDownload = async () => {
    if (!certificateRef.current) return;

    // Dynamic import to avoid SSR issues
    const html2canvas = (await import("html2canvas")).default;

    const canvas = await html2canvas(certificateRef.current, {
      scale: 2,
      backgroundColor: "#ffffff",
    });

    const link = document.createElement("a");
    link.download = `certificate-${data.certificate_id}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <div className="space-y-4">
      <div
        ref={certificateRef}
        className="relative aspect-[1.414] w-full max-w-2xl mx-auto bg-white border-8 border-double border-amber-600 p-8 shadow-xl"
      >
        {/* Decorative corners */}
        <div className="absolute top-4 left-4 w-16 h-16 border-t-4 border-l-4 border-amber-400" />
        <div className="absolute top-4 right-4 w-16 h-16 border-t-4 border-r-4 border-amber-400" />
        <div className="absolute bottom-4 left-4 w-16 h-16 border-b-4 border-l-4 border-amber-400" />
        <div className="absolute bottom-4 right-4 w-16 h-16 border-b-4 border-r-4 border-amber-400" />

        <div className="h-full flex flex-col items-center justify-center text-center">
          {/* Header */}
          <div className="flex items-center gap-3 mb-2">
            <Award className="h-10 w-10 text-amber-600" />
          </div>
          <h1 className="text-3xl font-serif font-bold text-gray-800 tracking-wide">
            Certificate of Completion
          </h1>

          {/* Divider */}
          <div className="my-6 w-48 h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent" />

          {/* Main content */}
          <p className="text-gray-600 mb-2">This is to certify that</p>
          <h2 className="text-2xl font-serif font-bold text-gray-900 mb-4">
            {data.user_name}
          </h2>
          <p className="text-gray-600 mb-2">has successfully completed</p>
          <h3 className="text-xl font-semibold text-primary mb-6">
            {data.track_title}
          </h3>

          {/* Date */}
          <p className="text-gray-500 text-sm mb-6">
            Completed on {data.completed_at}
          </p>

          {/* Footer */}
          <div className="mt-auto pt-4 border-t border-gray-200 w-full flex justify-between items-end text-xs text-gray-400">
            <div>
              <p className="font-mono">ID: {data.certificate_id}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-gray-600">LiveLabs</p>
              <p>Guided Learning Platform</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-center">
        <Button onClick={handleDownload} className="gap-2">
          <Download className="h-4 w-4" />
          Download Certificate
        </Button>
      </div>
    </div>
  );
}
