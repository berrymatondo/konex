import { put, get } from "@vercel/blob";
import { type NextRequest, NextResponse } from "next/server";

// Upload a single photo evidence file to private Blob storage.
// Returns the blob pathname which is persisted with the reception record.
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const poId = (formData.get("poId") as string) || "unknown";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate type and size (JPG/PNG, <= 5MB) to match the UI constraints
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      return NextResponse.json({ error: "Only JPG/PNG images are allowed" }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Image must be 5MB or smaller" }, { status: 400 });
    }

    const timestamp = Date.now();
    const extension = file.name.split(".").pop() || "jpg";
    const pathname = `vault-intake/${poId}/evidence_${timestamp}.${extension}`;

    // Private storage — sensitive chain-of-custody evidence
    const blob = await put(pathname, file, { access: "private" });

    return NextResponse.json({
      success: true,
      pathname: blob.pathname,
      fileName: file.name,
    });
  } catch (error) {
    console.error("Photo upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

// Stream a private photo evidence blob back to the client by its pathname.
export async function GET(request: NextRequest) {
  try {
    const pathname = request.nextUrl.searchParams.get("pathname");
    if (!pathname) {
      return NextResponse.json({ error: "Missing pathname" }, { status: 400 });
    }

    const result = await get(pathname, {
      access: "private",
      ifNoneMatch: request.headers.get("if-none-match") ?? undefined,
    });

    if (!result) {
      return new NextResponse("Not found", { status: 404 });
    }

    if (result.statusCode === 304) {
      return new NextResponse(null, {
        status: 304,
        headers: { ETag: result.blob.etag, "Cache-Control": "private, no-cache" },
      });
    }

    return new NextResponse(result.stream, {
      headers: {
        "Content-Type": result.blob.contentType,
        ETag: result.blob.etag,
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (error) {
    console.error("Error serving photo:", error);
    return NextResponse.json({ error: "Failed to serve photo" }, { status: 500 });
  }
}
