import { getArtist, getTrack, parseBodyLastfm, sign, stringifyBodylastfm } from "@/lib/functions";
import axios from "axios";
import { NextRequest } from "next/server";

const root = "http://ws.audioscrobbler.com/2.0/";

const blacklistedHeaders = [
    "cf-connecting-ip", "cf-worker",
    "cf-ray", "cf-visitor", "cf-ew-via",
    "cdn-loop", "x-amzn-trace-id", "cf-ipcountry",
    "x-forwarded-for", "x-forwarded-host",
    "x-forwarded-proto", "forwarded",
    "x-real-ip", "host", "origin"
];

export async function GET(req: NextRequest) {
    const reqHeaders: { [key: string]: string } = {}
    req.headers.entries().forEach(([headerKey, headerValue]) => {
        if (Object.keys(reqHeaders).includes(headerKey)) return
        if (headerKey.startsWith("x-replace-")) return reqHeaders[headerKey.replace("x-replace-", "")] = headerValue
        if (blacklistedHeaders.includes(headerKey.toLowerCase())) return
        reqHeaders[headerKey] = headerValue
    })


    const request = await axios.get(root, {
        responseType: 'arraybuffer',
        headers: reqHeaders,
        params: req.nextUrl.searchParams,
        validateStatus: () => true
    })

    const resHeaders: { [key: string]: string } = {}
    for (const key in request.headers) {
        if (key == "content-length") continue
        const value = request.headers[key];
        resHeaders[key] = value
    }

    return new Response(request.data, { status: request.status, headers: resHeaders })
}

export async function POST(req: NextRequest) {
    const body = await req.text()
    const params = parseBodyLastfm(body);

    const signature_computed = sign({ ...params, api_sig: undefined })
    const signature_received = params.api_sig as string
    if (!signature_received || signature_computed != signature_received) {
        console.log(
            `invalid signature.\n` +
            `You gave me: ${signature_received}\n` +
            `I got: ${signature_computed}\n` +
            `Your body: ${JSON.stringify({ ...params, api_sig: undefined })}`);

        return new Response(
            `invalid signature.\n` +
            `You gave me: ${signature_received}\n` +
            `I got: ${signature_computed}\n` +
            `Your body: ${JSON.stringify({ ...params, api_sig: undefined })}`,
            { status: 400 }
        )
    }

    const buildSwappedParams = () => {
        if (params.items && typeof params.items !== "string") return {
            ...params,
            isrc: undefined,
            items: params.items.map((item: { [key: string]: string }) => rewriteItem({ isrc: item.isrc, track: item.track, artist: item.artist })),
        }
        return rewriteItem({ artist: params.artist as string, track: params.track as string, album: params.album as string, isrc: params.isrc as string, ...params })
    }

    const rawSwappedParams = buildSwappedParams()
    Object.keys(rawSwappedParams).forEach((key) => {
        const val = rawSwappedParams[key as keyof typeof rawSwappedParams]
        if (val === undefined) delete rawSwappedParams[key as keyof typeof rawSwappedParams]
    })

    const signedSwappedParams = (signBody(rawSwappedParams))

    const request = await axios.request({
        responseType: 'arraybuffer',
        method: 'post',
        maxBodyLength: Infinity,
        url: root,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        validateStatus: () => true,
        data: signedSwappedParams
    })
    const resHeaders: { [key: string]: string } = {}
    for (const key in request.headers) {
        if (key == "content-length") continue
        const value = request.headers[key];
        resHeaders[key] = value
    }
    return new Response(request.data, { status: request.status, headers: resHeaders })
}

function rewriteItem(item: { isrc?: string; track: string; artist: string;[key: string]: any }) {
    const track = getTrack({ isrc: item.isrc, name: item.track, artist: item.artist });
    if (track) return {
        ...item,
        track: track.name_to,
        artist: track.artist_to,
        album: track.album_to,
        isrc: undefined,
    };

    const artist = getArtist(item.artist)
    if (artist) return {
        ...item,
        artist: artist.to,
        isrc: undefined,
    };

    return item;

}
function signBody(params: { [key: string]: any; }) {
    return stringifyBodylastfm({ ...params, "api_sig": sign(params) })
}