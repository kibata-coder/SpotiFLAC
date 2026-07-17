import React, { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

interface LikeButtonProps {
  userId: string | null;
  itemType: 'album' | 'artist';
  itemId: string;
  itemName: string;
  itemCover: string;
  className?: string;
  iconSize?: number;
}

export const LikeButton: React.FC<LikeButtonProps> = ({
  userId,
  itemType,
  itemId,
  itemName,
  itemCover,
  className = '',
  iconSize = 16,
}) => {
  const [isLiked, setIsLiked] = useState(false);
  const [loading, setLoading] = useState(false);

  const tableName = itemType === 'album' ? 'liked_albums' : 'liked_artists';
  const idCol = itemType === 'album' ? 'album_id' : 'artist_id';

  useEffect(() => {
    if (!userId || !itemId) {
      setIsLiked(false);
      return;
    }
    
    let isMounted = true;
    supabase
      .from(tableName)
      .select('id')
      .eq('user_id', userId)
      .eq(idCol, itemId)
      .maybeSingle()
      .then(({ data }) => {
        if (isMounted) setIsLiked(!!data);
      });

    return () => { isMounted = false; };
  }, [userId, itemId, tableName, idCol]);

  const toggleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!userId) {
      toast.error(`Sign in to save ${itemType}s`);
      return;
    }

    setLoading(true);
    try {
      if (isLiked) {
        await supabase
          .from(tableName)
          .delete()
          .eq('user_id', userId)
          .eq(idCol, itemId);
        setIsLiked(false);
        toast.success(`Removed ${itemType}`);
      } else {
        const payload = itemType === 'album' 
          ? { user_id: userId, album_id: itemId, album_name: itemName, album_cover: itemCover }
          : { user_id: userId, artist_id: itemId, artist_name: itemName, artist_cover: itemCover };
        
        await supabase.from(tableName).insert(payload);
        setIsLiked(true);
        toast.success(`Saved to your library ♥`);
      }
    } catch (err) {
      toast.error(`Failed to update library`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggleLike}
      disabled={loading}
      className={`sp-icon-btn ${className}`}
      title={isLiked ? `Remove ${itemType}` : `Save ${itemType}`}
    >
      <Heart 
        size={iconSize} 
        className={isLiked ? "fill-emerald-500 text-emerald-500" : "text-white opacity-60 hover:opacity-100 transition-opacity"} 
      />
    </button>
  );
};
