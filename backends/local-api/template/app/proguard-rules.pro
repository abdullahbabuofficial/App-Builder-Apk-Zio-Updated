# Add project-specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in proguard-android-optimize.txt.

-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod
-keep class android.webkit.** { *; }
