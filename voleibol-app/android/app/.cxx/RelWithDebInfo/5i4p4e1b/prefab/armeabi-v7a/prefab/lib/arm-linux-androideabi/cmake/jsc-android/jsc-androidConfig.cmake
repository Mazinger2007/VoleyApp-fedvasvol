if(NOT TARGET jsc-android::jsc)
add_library(jsc-android::jsc SHARED IMPORTED)
set_target_properties(jsc-android::jsc PROPERTIES
    IMPORTED_LOCATION "C:/Users/hugog/.gradle/caches/9.0.0/transforms/c70bcff5eed91f6209cc41539ff3b313/transformed/jsc-android-2026004.0.1/prefab/modules/jsc/libs/android.armeabi-v7a/libjsc.so"
    INTERFACE_INCLUDE_DIRECTORIES "C:/Users/hugog/.gradle/caches/9.0.0/transforms/c70bcff5eed91f6209cc41539ff3b313/transformed/jsc-android-2026004.0.1/prefab/modules/jsc/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

