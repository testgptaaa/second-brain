#import <Foundation/Foundation.h>
#import <Vision/Vision.h>
#import <Cocoa/Cocoa.h>

int main(int argc, const char * argv[]) {
    @autoreleasepool {
        if (argc < 2) return 0;
        NSString *path = [NSString stringWithUTF8String:argv[1]];
        NSURL *url = [NSURL fileURLWithPath:path];
        NSImage *image = [[NSImage alloc] initWithContentsOfURL:url];
        if (!image) return 0;
        CGImageRef cgImage = [image CGImageForProposedRect:NULL context:NULL hints:NULL];
        if (!cgImage) return 0;

        VNRecognizeTextRequest *request = [[VNRecognizeTextRequest alloc] initWithCompletionHandler:^(VNRequest *req, NSError *error) {
            if (error) return;
            for (VNRecognizedTextObservation *obs in req.results) {
                VNRecognizedText *text = [[obs topCandidates:1] firstObject];
                if (text) {
                    printf("%s\n", [text.string UTF8String]);
                }
            }
        }];
        request.recognitionLevel = VNRequestTextRecognitionLevelAccurate;
        request.recognitionLanguages = @[@"ru-RU", @"en-US"];
        request.usesLanguageCorrection = YES;

        VNImageRequestHandler *handler = [[VNImageRequestHandler alloc] initWithCGImage:cgImage options:@{}];
        [handler performRequests:@[request] error:nil];
    }
    return 0;
}
