/**
 * Animation Utilities
 * Reusable animation helpers
 */

export class AnimationHelper {
  /**
   * Fade in element
   */
  static fadeIn(element, duration = 300) {
    return new Promise(resolve => {
      element.style.opacity = '0';
      element.style.display = 'block';
      
      const animation = element.animate(
        [
          { opacity: 0 },
          { opacity: 1 }
        ],
        {
          duration,
          easing: 'ease-out',
          fill: 'forwards'
        }
      );
      
      animation.onfinish = () => {
        element.style.opacity = '1';
        resolve();
      };
    });
  }
  
  /**
   * Fade out element
   */
  static fadeOut(element, duration = 300) {
    return new Promise(resolve => {
      const animation = element.animate(
        [
          { opacity: 1 },
          { opacity: 0 }
        ],
        {
          duration,
          easing: 'ease-in',
          fill: 'forwards'
        }
      );
      
      animation.onfinish = () => {
        element.style.display = 'none';
        resolve();
      };
    });
  }
  
  /**
   * Slide in from top
   */
  static slideInDown(element, duration = 300) {
    return new Promise(resolve => {
      element.style.display = 'block';
      
      const animation = element.animate(
        [
          { transform: 'translateY(-100%)', opacity: 0 },
          { transform: 'translateY(0)', opacity: 1 }
        ],
        {
          duration,
          easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
          fill: 'forwards'
        }
      );
      
      animation.onfinish = resolve;
    });
  }
  
  /**
   * Slide in from bottom
   */
  static slideInUp(element, duration = 300) {
    return new Promise(resolve => {
      element.style.display = 'block';
      
      const animation = element.animate(
        [
          { transform: 'translateY(100%)', opacity: 0 },
          { transform: 'translateY(0)', opacity: 1 }
        ],
        {
          duration,
          easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
          fill: 'forwards'
        }
      );
      
      animation.onfinish = resolve;
    });
  }
  
  /**
   * Scale in
   */
  static scaleIn(element, duration = 300) {
    return new Promise(resolve => {
      element.style.display = 'block';
      
      const animation = element.animate(
        [
          { transform: 'scale(0.9)', opacity: 0 },
          { transform: 'scale(1)', opacity: 1 }
        ],
        {
          duration,
          easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
          fill: 'forwards'
        }
      );
      
      animation.onfinish = resolve;
    });
  }
  
  /**
   * Scale out
   */
  static scaleOut(element, duration = 300) {
    return new Promise(resolve => {
      const animation = element.animate(
        [
          { transform: 'scale(1)', opacity: 1 },
          { transform: 'scale(0.9)', opacity: 0 }
        ],
        {
          duration,
          easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
          fill: 'forwards'
        }
      );
      
      animation.onfinish = () => {
        element.style.display = 'none';
        resolve();
      };
    });
  }
  
  /**
   * Shake animation
   */
  static shake(element, duration = 500) {
    return new Promise(resolve => {
      const animation = element.animate(
        [
          { transform: 'translateX(0)' },
          { transform: 'translateX(-10px)' },
          { transform: 'translateX(10px)' },
          { transform: 'translateX(-10px)' },
          { transform: 'translateX(10px)' },
          { transform: 'translateX(0)' }
        ],
        {
          duration,
          easing: 'ease-in-out'
        }
      );
      
      animation.onfinish = resolve;
    });
  }
  
  /**
   * Pulse animation
   */
  static pulse(element, duration = 1000) {
    return new Promise(resolve => {
      const animation = element.animate(
        [
          { transform: 'scale(1)' },
          { transform: 'scale(1.05)' },
          { transform: 'scale(1)' }
        ],
        {
          duration,
          easing: 'ease-in-out'
        }
      );
      
      animation.onfinish = resolve;
    });
  }
  
  /**
   * Bounce animation
   */
  static bounce(element, duration = 600) {
    return new Promise(resolve => {
      const animation = element.animate(
        [
          { transform: 'translateY(0)' },
          { transform: 'translateY(-20px)' },
          { transform: 'translateY(0)' },
          { transform: 'translateY(-10px)' },
          { transform: 'translateY(0)' }
        ],
        {
          duration,
          easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
        }
      );
      
      animation.onfinish = resolve;
    });
  }
}

export default AnimationHelper;
