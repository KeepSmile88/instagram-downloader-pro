/**
 * Instagram Media Extraction System
 * Handles extraction of media URLs, metadata, and statistics from Instagram DOM
 */

import { Logger } from './logger.js';
import { Helpers } from '../utils/helpers.js';
import { SELECTORS } from '../utils/constants.js';

export class MediaExtractor {
  /**
   * Extract media from a post element
   */
  static extractFromPost(postElement) {
    try {
      const mediaItems = [];
      
      // Extract images
      const images = this.extractImages(postElement);
      mediaItems.push(...images);
      
      // Extract videos
      const videos = this.extractVideos(postElement);
      mediaItems.push(...videos);
      
      // Extract metadata
      const metadata = this.extractMetadata(postElement);
      
      // Add metadata to each item
      mediaItems.forEach(item => {
        Object.assign(item, metadata);
      });
      
      // Deduplicate
      const deduplicated = this.deduplicateMedia(mediaItems);
      
      Logger.debug('Extracted media from post', {
        count: deduplicated.length,
        types: this.countTypes(deduplicated)
      });
      
      return deduplicated;
    } catch (error) {
      Logger.error('Failed to extract media from post', {}, error);
      return [];
    }
  }
  
  /**
   * Extract images from element
   */
  static extractImages(element) {
    const images = [];
    
    try {
      const imgElements = this.findElements(element, SELECTORS.image);
      
      imgElements.forEach(img => {
        const srcset = img.getAttribute('srcset');
        const src = img.getAttribute('src');
        
        let highestQualityUrl = null;
        
        if (srcset) {
          highestQualityUrl = Helpers.getHighestQualityImage(srcset);
        } else if (src) {
          highestQualityUrl = src;
        }
        
        if (highestQualityUrl && Helpers.isInstagramMediaUrl(highestQualityUrl)) {
          images.push({
            url: highestQualityUrl,
            type: 'image',
            thumbnail: src || highestQualityUrl,
            filename: this.generateFilename(highestQualityUrl, 'image'),
            extractedAt: Date.now()
          });
        }
      });
    } catch (error) {
      Logger.warn('Failed to extract images', {}, error);
    }
    
    return images;
  }
  
  /**
   * Extract videos from element
   */
  static extractVideos(element) {
    const videos = [];
    
    try {
      const videoElements = this.findElements(element, SELECTORS.video);
      
      videoElements.forEach(video => {
        const src = video.getAttribute('src');
        const poster = video.getAttribute('poster');
        
        if (src && Helpers.isInstagramMediaUrl(src)) {
          videos.push({
            url: src,
            type: 'video',
            thumbnail: poster || src,
            filename: this.generateFilename(src, 'video'),
            duration: video.duration || 0,
            extractedAt: Date.now()
          });
        }
        
        // Check source elements
        const sources = video.querySelectorAll('source');
        sources.forEach(source => {
          const sourceSrc = source.getAttribute('src');
          if (sourceSrc && Helpers.isInstagramMediaUrl(sourceSrc)) {
            videos.push({
              url: sourceSrc,
              type: 'video',
              thumbnail: poster || sourceSrc,
              filename: this.generateFilename(sourceSrc, 'video'),
              extractedAt: Date.now()
            });
          }
        });
      });
    } catch (error) {
      Logger.warn('Failed to extract videos', {}, error);
    }
    
    return videos;
  }
  
  /**
   * Extract metadata (likes, comments, caption, etc.)
   */
  static extractMetadata(element) {
    const metadata = {
      likes: 0,
      comments: 0,
      views: 0,
      caption: '',
      postUrl: '',
      postId: '',
      timestamp: Date.now(),
      username: this.extractUsername(element)
    };
    
    try {
      // Extract likes
      metadata.likes = this.extractLikes(element);
      
      // Extract comments count
      metadata.comments = this.extractComments(element);
      
      // Extract views (for videos)
      metadata.views = this.extractViews(element);
      
      // Extract caption
      metadata.caption = this.extractCaption(element);
      
      // Extract post URL and ID
      const postLink = element.querySelector('a[href*="/p/"], a[href*="/reel/"]');
      if (postLink) {
        const href = postLink.getAttribute('href');
        metadata.postUrl = `https://www.instagram.com${href}`;
        
        const match = href.match(/\/(p|reel)\/([^\/]+)/);
        if (match) {
          metadata.postId = match[2];
        }
      }
      
      // Extract timestamp
      const timeElement = element.querySelector('time[datetime]');
      if (timeElement) {
        const datetime = timeElement.getAttribute('datetime');
        metadata.timestamp = new Date(datetime).getTime();
      }
    } catch (error) {
      Logger.warn('Failed to extract metadata', {}, error);
    }
    
    return metadata;
  }
  
  /**
   * Extract likes count
   */
  static extractLikes(element) {
    try {
      // Method 1: From button aria-label
      const likeButton = element.querySelector('button[aria-label*="like"]');
      if (likeButton) {
        const ariaLabel = likeButton.getAttribute('aria-label');
        const match = ariaLabel?.match(/(\d+[\d,]*)/);
        if (match) {
          return parseInt(match[1].replace(/,/g, ''));
        }
      }
      
      // Method 2: From text content
      const likeElements = this.findElements(element, SELECTORS.likes);
      for (const el of likeElements) {
        const text = el.textContent;
        const match = text.match(/(\d+[\d,]*)\s*like/i);
        if (match) {
          return parseInt(match[1].replace(/,/g, ''));
        }
      }
    } catch (error) {
      Logger.debug('Failed to extract likes', {}, error);
    }
    
    return 0;
  }
  
  /**
   * Extract comments count
   */
  static extractComments(element) {
    try {
      const commentElements = this.findElements(element, SELECTORS.comments);
      
      for (const el of commentElements) {
        const text = el.textContent;
        const match = text.match(/(\d+[\d,]*)/);
        if (match) {
          return parseInt(match[0].replace(/,/g, ''));
        }
      }
    } catch (error) {
      Logger.debug('Failed to extract comments', {}, error);
    }
    
    return 0;
  }
  
  /**
   * Extract views count (for videos)
   */
  static extractViews(element) {
    try {
      const viewElements = element.querySelectorAll('[class*="view"], [aria-label*="view"]');
      
      for (const el of viewElements) {
        const text = el.textContent || el.getAttribute('aria-label') || '';
        const match = text.match(/(\d+[\d,]*)\s*view/i);
        if (match) {
          return parseInt(match[1].replace(/,/g, ''));
        }
      }
    } catch (error) {
      Logger.debug('Failed to extract views', {}, error);
    }
    
    return 0;
  }
  
  /**
   * Extract caption
   */
  static extractCaption(element) {
    try {
      const captionElement = element.querySelector('[class*="Caption"]');
      if (captionElement) {
        return captionElement.textContent.trim();
      }
      
      // Fallback: look for long text content
      const textElements = element.querySelectorAll('span');
      for (const el of textElements) {
        const text = el.textContent.trim();
        if (text.length > 20 && !text.includes('http')) {
          return text;
        }
      }
    } catch (error) {
      Logger.debug('Failed to extract caption', {}, error);
    }
    
    return '';
  }
  
  /**
   * Extract username
   */
  static extractUsername(element) {
    try {
      const usernameLink = element.querySelector('a[href^="/"][href*="/"]:not([href*="/p/"]):not([href*="/reel/"])');
      if (usernameLink) {
        const href = usernameLink.getAttribute('href');
        const match = href.match(/^\/([^\/]+)/);
        if (match) {
          return match[1];
        }
      }
    } catch (error) {
      Logger.debug('Failed to extract username', {}, error);
    }
    
    return 'unknown';
  }
  
  /**
   * Find elements with fallback selectors
   */
  static findElements(parent, selectorConfig) {
    const elements = [];
    
    // Try primary selector
    const primary = parent.querySelectorAll(selectorConfig.primary);
    if (primary.length > 0) {
      elements.push(...primary);
      return elements;
    }
    
    // Try fallback selectors
    if (selectorConfig.fallback) {
      for (const fallback of selectorConfig.fallback) {
        const fallbackElements = parent.querySelectorAll(fallback);
        if (fallbackElements.length > 0) {
          elements.push(...fallbackElements);
          Logger.debug('Used fallback selector', {
            primary: selectorConfig.primary,
            fallback
          });
          return elements;
        }
      }
    }
    
    return elements;
  }
  
  /**
   * Generate filename for media
   */
  static generateFilename(url, type) {
    const timestamp = Date.now();
    const extension = type === 'video' ? 'mp4' : 'jpg';
    const urlHash = Math.abs(Helpers.hashCode(url)).toString();
    
    return `${timestamp}_${urlHash}.${extension}`;
  }
  
  /**
   * Deduplicate media items
   */
  static deduplicateMedia(items) {
    const seen = new Set();
    return items.filter(item => {
      if (seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    });
  }
  
  /**
   * Count media types
   */
  static countTypes(items) {
    return items.reduce((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    }, {});
  }
  
  /**
   * Extract from Instagram's shared data
   */
  static extractFromSharedData() {
    try {
      if (window._sharedData) {
        return this.parseSharedData(window._sharedData);
      }
      
      // Try to find in scripts
      const scripts = document.querySelectorAll('script:not([src])');
      for (const script of scripts) {
        const content = script.textContent;
        
        if (content.includes('window._sharedData')) {
          const match = content.match(/window\._sharedData\s*=\s*({.+?});/);
          if (match) {
            const sharedData = JSON.parse(match[1]);
            return this.parseSharedData(sharedData);
          }
        }
      }
    } catch (error) {
      Logger.warn('Failed to extract from shared data', {}, error);
    }
    
    return [];
  }
  
  /**
   * Parse Instagram's shared data structure
   */
  static parseSharedData(sharedData) {
    const mediaItems = [];
    
    try {
      // Navigate through the data structure
      const entryData = sharedData.entry_data;
      
      if (entryData?.PostPage) {
        const posts = entryData.PostPage;
        posts.forEach(page => {
          const media = page.graphql?.shortcode_media;
          if (media) {
            mediaItems.push(...this.parseGraphQLMedia(media));
          }
        });
      }
      
      if (entryData?.ProfilePage) {
        const profiles = entryData.ProfilePage;
        profiles.forEach(page => {
          const user = page.graphql?.user;
          if (user?.edge_owner_to_timeline_media?.edges) {
            user.edge_owner_to_timeline_media.edges.forEach(edge => {
              mediaItems.push(...this.parseGraphQLMedia(edge.node));
            });
          }
        });
      }
    } catch (error) {
      Logger.warn('Failed to parse shared data', {}, error);
    }
    
    return mediaItems;
  }
  
  /**
   * Parse GraphQL media object
   */
  static parseGraphQLMedia(media) {
    const items = [];
    
    try {
      // Single image
      if (media.display_url) {
        items.push({
          url: media.display_url,
          type: media.is_video ? 'video' : 'image',
          thumbnail: media.display_url,
          filename: this.generateFilename(media.display_url, media.is_video ? 'video' : 'image'),
          likes: media.edge_media_preview_like?.count || 0,
          comments: media.edge_media_to_comment?.count || 0,
          caption: media.edge_media_to_caption?.edges[0]?.node?.text || '',
          postId: media.shortcode,
          postUrl: `https://www.instagram.com/p/${media.shortcode}/`,
          timestamp: media.taken_at_timestamp * 1000
        });
      }
      
      // Video URL
      if (media.video_url) {
        items.push({
          url: media.video_url,
          type: 'video',
          thumbnail: media.display_url,
          filename: this.generateFilename(media.video_url, 'video'),
          views: media.video_view_count || 0,
          duration: media.video_duration || 0,
          likes: media.edge_media_preview_like?.count || 0,
          comments: media.edge_media_to_comment?.count || 0,
          caption: media.edge_media_to_caption?.edges[0]?.node?.text || '',
          postId: media.shortcode,
          postUrl: `https://www.instagram.com/p/${media.shortcode}/`,
          timestamp: media.taken_at_timestamp * 1000
        });
      }
      
      // Carousel (multiple images/videos)
      if (media.edge_sidecar_to_children?.edges) {
        media.edge_sidecar_to_children.edges.forEach(edge => {
          const childMedia = edge.node;
          
          if (childMedia.display_url) {
            items.push({
              url: childMedia.video_url || childMedia.display_url,
              type: childMedia.is_video ? 'video' : 'image',
              thumbnail: childMedia.display_url,
              filename: this.generateFilename(
                childMedia.video_url || childMedia.display_url,
                childMedia.is_video ? 'video' : 'image'
              ),
              likes: media.edge_media_preview_like?.count || 0,
              comments: media.edge_media_to_comment?.count || 0,
              caption: media.edge_media_to_caption?.edges[0]?.node?.text || '',
              postId: media.shortcode,
              postUrl: `https://www.instagram.com/p/${media.shortcode}/`,
              timestamp: media.taken_at_timestamp * 1000
            });
          }
        });
      }
    } catch (error) {
      Logger.warn('Failed to parse GraphQL media', {}, error);
    }
    
    return items;
  }
}

