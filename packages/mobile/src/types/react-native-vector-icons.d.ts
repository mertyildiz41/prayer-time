declare module 'react-native-vector-icons/Ionicons' {
  import type { ComponentType } from 'react';
  import type { StyleProp, TextStyle } from 'react-native';

  interface IoniconsProps {
    name: string;
    size?: number;
    color?: string;
    style?: StyleProp<TextStyle>;
  }

  const Ionicons: ComponentType<IoniconsProps>;
  export default Ionicons;
}
