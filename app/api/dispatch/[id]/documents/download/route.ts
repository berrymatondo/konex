import { type NextRequest, NextResponse } from 'next/server';
import { get } from '@vercel/blob';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const pathname = request.nextUrl.searchParams.get('pathname');

    if (!pathname) {
      return NextResponse.json({ error: 'Missing pathname' }, { status: 400 });
    }

    // Verify the pathname belongs to this dispatch (security check)
    if (!pathname.includes(`dispatch/${id}/`)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const result = await get(pathname, {
      access: 'private',
      ifNoneMatch: request.headers.get('if-none-match') ?? undefined,
    });

    if (!result) {
      return new NextResponse('Not found', { status: 404 });
    }

    // Blob hasn't changed — tell the browser to use its cached copy
    if (result.statusCode === 304) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: result.blob.etag,
          'Cache-Control': 'private, no-cache',
        },
      });
    }

    // Extract filename from pathname for Content-Disposition
    const filename = pathname.split('/').pop() || 'document';

    return new NextResponse(result.stream, {
      headers: {
        'Content-Type': result.blob.contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        ETag: result.blob.etag,
        'Cache-Control': 'private, no-cache',
      },
    });
  } catch (error) {
    console.error('Error serving file:', error);
    return NextResponse.json({ error: 'Failed to serve file' }, { status: 500 });
  }
}
