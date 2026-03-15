import md5 from "md5"
import db from "./db.json"
import dbArtist from "./artist_db.json"

export function parseBodyLastfm(body: string) {
    const parsedJson: { [key: string]: any } = {}
    new URLSearchParams(body)
        .entries()
        .forEach(([key, val]) => {
            const arrayRegex = /^(.+)(?:\[(\d+)\])$/gm
            const arrayKeys = arrayRegex.exec(key)
            if (arrayKeys === null) return parsedJson[key] = val
            const [, arrayKey, index_str] = arrayKeys
            const index = parseInt(index_str)
            if (!parsedJson["items"]) parsedJson["items"] = []
            if (!parsedJson["items"][index]) parsedJson["items"][index] = {}
            parsedJson["items"][index][arrayKey] = val
        })
    return parsedJson as { [key: string]: string | { [key: string]: string }[] }
}
export function stringifyBodylastfm(params: { [key: string]: string | { [key: string]: string }[] }) {
    const paramsUri = new URLSearchParams()
    Object.entries(params).forEach(([entry_key, entry_value]) => {
        if (typeof entry_value == "string") return (paramsUri.set(entry_key, entry_value));
        entry_value.forEach((entry: { [key: string]: any }, i: number) => Object.entries(entry).forEach(([ek, ev]) => paramsUri.set(`${ek}[${i}]`, ev)))
    });
    return paramsUri.toString()
}
export function sign(data: { [key: string]: string | { [key: string]: string }[] | undefined }) {
    const raw = Object.entries(data)
        .filter(([key]) => !["format", "api_sig"].includes(key))
        .map((entry) => {
            if (typeof entry[1] == "string") return entry[0] + entry[1]
            if (entry[1] && entry[1][0]) return entry[1]
                .map((e: { [key: string]: any }, i: number) =>
                    Object
                        .entries(e)
                        .map(([ek, ev]) => ev ? `${ek}[${i}]${ev}` : undefined)
                        .filter((v: any) => v)
                ).flat()
        })
        .filter((v: any) => v)
        .flat()
        .sort()
        .join("") + process.env.LASTFM_API_SECRET
    return md5(raw)
}
export function getTrack(track: {
    isrc?: string,
    name: string,
    artist: string,
}) {
    if (track.isrc && Object.hasOwn(db, track.isrc as string)) {
        const entry = (db as {
            [isrc: string]: {
                name_from: string,
                name_to: string,
                artist_from: string,
                artist_to: string,
                album_from: string,
                album_to: string
            }
        })[track.isrc as string]
        if (entry) return entry
    }

    const track_to = (Object.values(db).find(trackDb => trackDb.name_from == track.name && trackDb.artist_from == track.artist));
    return track_to
}

export function getArtist(artist: string) {
    const entry = (dbArtist as { from: string, to: string }[]).find(e => e.from == artist)
    return entry
}