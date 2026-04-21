import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, ThumbsUp, Share2, Repeat2 } from "lucide-react";

interface PostPreviewProps {
  platform: string;
  caption: string;
  hashtags?: string;
  image_url?: string;
  cta_link?: string;
  clinic_name?: string;
  clinic_logo?: string;
}

export function PostPreview({ platform, caption, hashtags, image_url, cta_link, clinic_name = "Your Clinic", clinic_logo }: PostPreviewProps) {
  const captionWithTags = `${caption}${hashtags ? "\n\n" + hashtags : ""}`;

  if (platform === "Instagram") {
    return (
      <div className="max-w-md mx-auto bg-background border border-border rounded-lg overflow-hidden shadow-sm">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-0.5">
              <div className="w-full h-full rounded-full bg-background flex items-center justify-center overflow-hidden">
                {clinic_logo ? <img src={clinic_logo} alt="" className="w-full h-full object-cover" /> : <span className="text-xs font-bold">{clinic_name[0]}</span>}
              </div>
            </div>
            <span className="text-sm font-semibold">{clinic_name.toLowerCase().replace(/\s+/g, "_")}</span>
          </div>
          <MoreHorizontal className="w-5 h-5" />
        </div>
        {image_url ? (
          <img src={image_url} alt="" className="w-full aspect-square object-cover" />
        ) : (
          <div className="w-full aspect-square bg-muted flex items-center justify-center text-muted-foreground text-sm">No image</div>
        )}
        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex gap-3"><Heart className="w-6 h-6" /><MessageCircle className="w-6 h-6" /><Send className="w-6 h-6" /></div>
            <Bookmark className="w-6 h-6" />
          </div>
          <p className="text-sm whitespace-pre-wrap"><span className="font-semibold">{clinic_name.toLowerCase().replace(/\s+/g, "_")}</span> {captionWithTags}</p>
          {cta_link && <a href={cta_link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary block truncate">{cta_link}</a>}
        </div>
      </div>
    );
  }

  if (platform === "Facebook") {
    return (
      <div className="max-w-md mx-auto bg-background border border-border rounded-lg overflow-hidden shadow-sm">
        <div className="p-3 flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold overflow-hidden">
            {clinic_logo ? <img src={clinic_logo} alt="" className="w-full h-full object-cover" /> : clinic_name[0]}
          </div>
          <div>
            <div className="text-sm font-semibold">{clinic_name}</div>
            <div className="text-xs text-muted-foreground">Sponsored · 🌍</div>
          </div>
        </div>
        <div className="px-3 pb-2">
          <p className="text-sm whitespace-pre-wrap">{captionWithTags}</p>
        </div>
        {image_url && <img src={image_url} alt="" className="w-full max-h-96 object-cover" />}
        {cta_link && (
          <div className="p-3 bg-muted/50 border-t border-border flex items-center justify-between">
            <div className="text-xs">
              <div className="text-muted-foreground uppercase">{new URL(cta_link.startsWith("http") ? cta_link : "https://" + cta_link).hostname}</div>
              <div className="font-semibold text-sm truncate">Learn more</div>
            </div>
            <button className="px-3 py-1.5 bg-muted text-xs font-semibold rounded">Learn More</button>
          </div>
        )}
        <div className="flex border-t border-border">
          <button className="flex-1 py-2 flex items-center justify-center gap-1 text-sm text-muted-foreground"><ThumbsUp className="w-4 h-4" /> Like</button>
          <button className="flex-1 py-2 flex items-center justify-center gap-1 text-sm text-muted-foreground"><MessageCircle className="w-4 h-4" /> Comment</button>
          <button className="flex-1 py-2 flex items-center justify-center gap-1 text-sm text-muted-foreground"><Share2 className="w-4 h-4" /> Share</button>
        </div>
      </div>
    );
  }

  if (platform === "Twitter") {
    return (
      <div className="max-w-md mx-auto bg-background border border-border rounded-lg p-3 shadow-sm">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-full bg-foreground/10 flex items-center justify-center font-bold flex-shrink-0 overflow-hidden">
            {clinic_logo ? <img src={clinic_logo} alt="" className="w-full h-full object-cover" /> : clinic_name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 text-sm">
              <span className="font-bold">{clinic_name}</span>
              <span className="text-muted-foreground">@{clinic_name.toLowerCase().replace(/\s+/g, "")} · now</span>
            </div>
            <p className="text-sm whitespace-pre-wrap mt-1">{captionWithTags}</p>
            {image_url && <img src={image_url} alt="" className="mt-2 rounded-2xl border border-border max-h-80 w-full object-cover" />}
            {cta_link && <a href={cta_link} target="_blank" rel="noopener noreferrer" className="text-sm text-primary block mt-1 truncate">{cta_link}</a>}
            <div className="flex justify-between mt-3 text-muted-foreground max-w-xs">
              <MessageCircle className="w-4 h-4" />
              <Repeat2 className="w-4 h-4" />
              <Heart className="w-4 h-4" />
              <Send className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // LinkedIn
  return (
    <div className="max-w-md mx-auto bg-background border border-border rounded-lg overflow-hidden shadow-sm">
      <div className="p-3 flex items-center gap-2">
        <div className="w-12 h-12 rounded-full bg-blue-700 flex items-center justify-center text-white font-bold overflow-hidden">
          {clinic_logo ? <img src={clinic_logo} alt="" className="w-full h-full object-cover" /> : clinic_name[0]}
        </div>
        <div>
          <div className="text-sm font-semibold">{clinic_name}</div>
          <div className="text-xs text-muted-foreground">Healthcare · Promoted</div>
          <div className="text-xs text-muted-foreground">now · 🌍</div>
        </div>
      </div>
      <div className="px-3 pb-2">
        <p className="text-sm whitespace-pre-wrap">{captionWithTags}</p>
      </div>
      {image_url && <img src={image_url} alt="" className="w-full max-h-96 object-cover" />}
      {cta_link && <a href={cta_link} target="_blank" rel="noopener noreferrer" className="block p-2 bg-muted text-xs text-primary truncate border-t border-border">{cta_link}</a>}
      <div className="flex border-t border-border">
        <button className="flex-1 py-2 flex items-center justify-center gap-1 text-xs text-muted-foreground"><ThumbsUp className="w-4 h-4" /> Like</button>
        <button className="flex-1 py-2 flex items-center justify-center gap-1 text-xs text-muted-foreground"><MessageCircle className="w-4 h-4" /> Comment</button>
        <button className="flex-1 py-2 flex items-center justify-center gap-1 text-xs text-muted-foreground"><Repeat2 className="w-4 h-4" /> Repost</button>
        <button className="flex-1 py-2 flex items-center justify-center gap-1 text-xs text-muted-foreground"><Send className="w-4 h-4" /> Send</button>
      </div>
    </div>
  );
}
