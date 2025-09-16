import { cn } from '@/lib/utils';
import type { Experimental_GeneratedImage } from 'ai';
import Image from 'next/image';

export type ImageProps = Experimental_GeneratedImage & {
  className?: string;
  alt?: string;
};

export const ImageComponent = ({
  base64,
  mediaType,
  ...props
}: ImageProps) => (
  <div
    className={cn(
      'relative aspect-video w-full overflow-hidden rounded-md',
      props.className,
    )}
  >
    <Image
      {...props}
      alt={props.alt ?? 'Generated image'}
      src={`data:${mediaType};base64,${base64}`}
      fill
      className="object-contain"
    />
  </div>
);
