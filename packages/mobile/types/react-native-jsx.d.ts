// import type * as React from 'react';
// import type * as ReactNative from 'react-native';

// type ExtractComponentName<T extends keyof typeof ReactNative> =
//   typeof ReactNative[T] extends React.JSXElementConstructor<any> ? T : never;

// type ReactNativeIntrinsicElements = {
//   [K in ExtractComponentName<keyof typeof ReactNative>]: React.ComponentProps<
//     Extract<
//       typeof ReactNative[K],
//       React.JSXElementConstructor<any>
//     >
//   >;
// };

// declare global {
//   namespace JSX {
//     // Augment default intrinsic elements with React Native host components.
//     interface IntrinsicElements extends ReactNativeIntrinsicElements {}
//   }
// }
